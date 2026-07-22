import { NextResponse } from "next/server";
import {
  calculateAdditionalSalesRevenueBreakdown,
  calculateCustomerRevenueBreakdown,
  type CustomerRevenueAnalyticsResponse,
  type RevenuePeriodInput,
} from "@/lib/analytics/customer-revenue-mix";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import {
  canViewCustomerRevenueAnalytics,
  canViewCustomerRevenueAnalyticsDetails,
} from "@/lib/permissions";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readPeriod(searchParams: URLSearchParams, fromKey: string, toKey: string): RevenuePeriodInput | null {
  const from = searchParams.get(fromKey)?.trim() ?? "";
  const to = searchParams.get(toKey)?.trim() ?? "";
  if (!DATE_KEY_PATTERN.test(from) || !DATE_KEY_PATTERN.test(to) || from > to) return null;
  return { from, to };
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canViewCustomerRevenueAnalytics(actorResult.actor)) {
    return NextResponse.json({ error: "Keine Berechtigung für Kundenumsatz-Auswertungen." }, { status: 403 });
  }

  const period = readPeriod(searchParams, "from", "to");
  const previousPeriod = readPeriod(searchParams, "previousFrom", "previousTo");
  if (!period || !previousPeriod) {
    return NextResponse.json({ error: "Der Auswertungszeitraum ist ungültig." }, { status: 400 });
  }

  const [invoices, projects, contacts, offers, potentials, taskLinks, legacyInvoiceCount, evaluableLegacyInvoiceCount] =
    await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId: organization.id },
        select: {
          id: true,
          projectId: true,
          projectNumber: true,
          projectTitle: true,
          invoiceNumber: true,
          customerName: true,
          status: true,
          netTotal: true,
          serviceDate: true,
          createdAt: true,
          sourceOfferId: true,
          sourceOfferNumber: true,
        },
      }),
      prisma.workPilotProject.findMany({
        where: { organizationId: organization.id },
        select: { id: true, contactId: true },
      }),
      prisma.contact.findMany({
        where: { organizationId: organization.id },
        select: { id: true, customerStatusOverride: true },
      }),
      prisma.offer.findMany({
        where: { organizationId: organization.id },
        select: { id: true, offerNumber: true },
      }),
      prisma.projectPotential.findMany({
        where: { organizationId: organization.id },
        select: { projectId: true, taskId: true },
      }),
      prisma.taskLink.findMany({
        where: { organizationId: organization.id },
        select: { taskId: true, url: true },
      }),
      prisma.legacyInvoice.count({ where: { organizationId: organization.id } }),
      prisma.legacyInvoice.count({ where: { organizationId: organization.id, isEvaluable: true } }),
    ]);

  const calculatePeriod = (targetPeriod: RevenuePeriodInput) => ({
    customerRevenue: calculateCustomerRevenueBreakdown({ invoices, projects, contacts, period: targetPeriod }),
    additionalSales: calculateAdditionalSalesRevenueBreakdown({
      invoices,
      offers,
      potentials,
      taskLinks,
      period: targetPeriod,
    }),
  });
  const currentBreakdown = calculatePeriod(period);
  const previousBreakdown = calculatePeriod(previousPeriod);
  const detailLimit = 200;
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice] as const));
  const currentCustomerDetails = currentBreakdown.customerRevenue.rows
    .flatMap((row) => {
      const invoice = invoiceById.get(row.invoiceId);
      return invoice ? [{
        ...row,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        projectNumber: invoice.projectNumber,
        projectTitle: invoice.projectTitle,
        invoiceStatus: invoice.status,
      }] : [];
    })
    .sort((first, second) => second.revenueAt.localeCompare(first.revenueAt));
  const currentAdditionalSalesDetails = currentBreakdown.additionalSales.rows
    .flatMap((row) => {
      const invoice = invoiceById.get(row.invoiceId);
      return invoice ? [{
        ...row,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        projectNumber: invoice.projectNumber,
        projectTitle: invoice.projectTitle,
        invoiceStatus: invoice.status,
        sourceOfferNumber: invoice.sourceOfferNumber,
      }] : [];
    })
    .sort((first, second) => second.revenueAt.localeCompare(first.revenueAt));

  const response: CustomerRevenueAnalyticsResponse = {
    period,
    previousPeriod,
    current: {
      customerRevenue: currentBreakdown.customerRevenue.mix,
      additionalSales: currentBreakdown.additionalSales.mix,
    },
    previous: {
      customerRevenue: previousBreakdown.customerRevenue.mix,
      additionalSales: previousBreakdown.additionalSales.mix,
    },
    dataQuality: {
      legacyInvoiceCount,
      evaluableLegacyInvoiceCount,
      legacyInvoicesIncluded: false,
      manualOverrideCount: contacts.filter((contact) => contact.customerStatusOverride !== "automatic").length,
    },
    details: canViewCustomerRevenueAnalyticsDetails(actorResult.actor)
      ? {
          customerRevenue: currentCustomerDetails.slice(0, detailLimit),
          additionalSales: currentAdditionalSalesDetails.slice(0, detailLimit),
          truncated:
            currentCustomerDetails.length > detailLimit || currentAdditionalSalesDetails.length > detailLimit,
        }
      : null,
  };

  return NextResponse.json(response);
}
