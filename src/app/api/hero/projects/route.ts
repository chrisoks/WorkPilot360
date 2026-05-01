import { NextResponse } from "next/server";
import {
  getHeroCustomerName,
  getHeroProjectDescription,
  getHeroProjectTitle,
  listHeroProjects,
} from "@/lib/hero/client";

export async function GET() {
  try {
    const projects = await listHeroProjects();

    return NextResponse.json(
      projects.map((project) => ({
        id: project.id,
        projectNumber: project.project_nr ?? "",
        title: getHeroProjectTitle(project),
        customer: getHeroCustomerName(project),
        status: project.current_project_match_status?.name ?? "",
        statusCode: project.current_project_match_status?.status_code ?? "",
        description: getHeroProjectDescription(project),
      }))
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "HERO Projekte konnten nicht geladen werden." },
      { status: 500 }
    );
  }
}
