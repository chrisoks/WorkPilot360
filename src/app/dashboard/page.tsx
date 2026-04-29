"use client";

import { useState } from "react";
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
  const [tasks, setTasks] = useState<TaskItem[]>(demoTasks);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [titel, setTitel] = useState("");
  const [status, setStatus] = useState<TaskStatus>("offen");
  const [prioritaet, setPrioritaet] = useState<TaskPriority>("normal");
  const [zustaendig, setZustaendig] = useState("");
  const [faelligkeit, setFaelligkeit] = useState("");

  const offene = tasks.filter((t) => t.status === "offen").length;
  const bearbeitung = tasks.filter((t) => t.status === "in Bearbeitung").length;
  const erledigt = tasks.filter((t) => t.status === "erledigt").length;

  function addTask() {
    if (!titel.trim()) return;

    const newTask: TaskItem = {
      id: `T-${1000 + tasks.length + 1}`,
      titel,
      status,
      prioritaet,
      zustaendig: zustaendig || "Nicht zugewiesen",
      faelligkeit: faelligkeit || "-",
    };

    setTasks([...tasks, newTask]);
    setTitel("");
    setStatus("offen");
    setPrioritaet("normal");
    setZustaendig("");
    setFaelligkeit("");
    setIsModalOpen(false);
  }

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
          <button className={styles.button} onClick={() => setIsModalOpen(true)}>
            Neue Aufgabe
          </button>
        </header>

        <section className={styles.cards}>
          <article className={styles.card}>
            <p className={styles.cardLabel}>Gesamt</p>
            <p className={styles.cardValue}>{tasks.length}</p>
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
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    {task.id} · {task.titel}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${statusClass[task.status]}`}>
                      {task.status}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${priorityClass[task.prioritaet]}`}>
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

        {isModalOpen && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              <h2>Neue Aufgabe erstellen</h2>

              <label style={labelStyle}>Titel</label>
              <input style={inputStyle} value={titel} onChange={(e) => setTitel(e.target.value)} />

              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                <option value="offen">offen</option>
                <option value="in Bearbeitung">in Bearbeitung</option>
                <option value="erledigt">erledigt</option>
              </select>

              <label style={labelStyle}>Priorität</label>
              <select style={inputStyle} value={prioritaet} onChange={(e) => setPrioritaet(e.target.value as TaskPriority)}>
                <option value="niedrig">niedrig</option>
                <option value="normal">normal</option>
                <option value="hoch">hoch</option>
              </select>

              <label style={labelStyle}>Zuständig</label>
              <input style={inputStyle} value={zustaendig} onChange={(e) => setZustaendig(e.target.value)} />

              <label style={labelStyle}>Fälligkeitsdatum</label>
              <input style={inputStyle} value={faelligkeit} onChange={(e) => setFaelligkeit(e.target.value)} placeholder="z. B. 30.04.2026" />

              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                <button className={styles.button} onClick={addTask}>
                  Speichern
                </button>
                <button style={secondaryButtonStyle} onClick={() => setIsModalOpen(false)}>
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
} as const;

const modalStyle = {
  width: "420px",
  maxWidth: "90vw",
  background: "white",
  borderRadius: "16px",
  padding: "24px",
  boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
} as const;

const labelStyle = {
  display: "block",
  marginTop: "12px",
  marginBottom: "6px",
  fontWeight: 600,
} as const;

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
} as const;

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
} as const;