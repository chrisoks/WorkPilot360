import styles from "./dashboard.module.css";

type TaskStatus = "offen" | "in Bearbeitung" | "erledigt";
type TaskPriority = "niedrig" | "normal" | "hoch";

type TaskItem = {
  id: string;
  titel: string;
  status: TaskStatus;
  prioritaet: TaskPriority;
  zustaendig: string;
  faelligkeit: string;
};

const demoTasks: TaskItem[] = [
  {
    id: "T-1021",
    titel: "Kundenanfrage prüfen",
    status: "offen",
    prioritaet: "hoch",
    zustaendig: "Mia Bauer",
    faelligkeit: "30.04.2026",
  },
  {
    id: "T-1022",
    titel: "Monatsreport aktualisieren",
    status: "in Bearbeitung",
    prioritaet: "normal",
    zustaendig: "Lars Klein",
    faelligkeit: "02.05.2026",
  },
  {
    id: "T-1023",
    titel: "Vertrag A12 abschließen",
    status: "erledigt",
    prioritaet: "niedrig",
    zustaendig: "Gina Roth",
    faelligkeit: "28.04.2026",
  },
];

const statusClass: Record<TaskStatus, string> = {
  offen: styles.open,
  "in Bearbeitung": styles.progress,
  erledigt: styles.done,
};

const priorityClass: Record<TaskPriority, string> = {
  niedrig: styles.low,
  normal: styles.normal,
  hoch: styles.high,
};

export default function DashboardPage() {
  const offene = demoTasks.filter((t) => t.status === "offen").length;
  const bearbeitung = demoTasks.filter(
    (t) => t.status === "in Bearbeitung"
  ).length;
  const erledigt = demoTasks.filter(
    (t) => t.status === "erledigt"
  ).length;

  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>Aufgaben-MGMT</div>
        <nav className={styles.nav}>
          <a className={`${styles.navItem} ${styles.active}`} href="/dashboard">
            Dashboard
          </a>
          <a className={styles.navItem} href="#">
            Aufgaben
          </a>
          <a className={styles.navItem} href="#">
            Kalender
          </a>
          <a className={styles.navItem} href="#">
            Teams
          </a>
          <a className={styles.navItem} href="#">
            Einstellungen
          </a>
        </nav>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>Meine Aufgaben</h1>
          <button className={styles.button}>Neue Aufgabe</button>
        </header>

        <section className={styles.cards}>
          <article className={styles.card}>
            <p className={styles.cardLabel}>Gesamt</p>
            <p className={styles.cardValue}>{demoTasks.length}</p>
          </article>

          <article className={styles.card}>
            <p className={styles.cardLabel}>Offen</p>
            <p className={styles.cardValue}>{offene}</p>
          </article>

          <article className={styles.card}>
            <p className={styles.cardLabel}>In Bearbeitung</p>
            <p className={styles.cardValue}>{bearbeitung}</p>
          </article>

          <article className={styles.card}>
            <p className={styles.cardLabel}>Erledigt</p>
            <p className={styles.cardValue}>{erledigt}</p>
          </article>
        </section>

        <section className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Aufgabe</th>
                <th>Status</th>
                <th>Priorität</th>
                <th>Zuständigkeit</th>
                <th>Fälligkeitsdatum</th>
              </tr>
            </thead>

            <tbody>
              {demoTasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    {task.id} · {task.titel}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        statusClass[task.status]
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        priorityClass[task.prioritaet]
                      }`}
                    >
                      {task.prioritaet}
                    </span>
                  </td>
                  <td>{task.zustaendig}</td>
                  <td>{task.faelligkeit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}