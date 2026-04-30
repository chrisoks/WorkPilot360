"use client";

import { useEffect, useState, type MouseEvent } from "react";
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

const emptyTask = {
  titel: "",
  status: "offen" as TaskStatus,
  prioritaet: "normal" as TaskPriority,
  zustaendig: "",
  faelligkeit: "",
};

export function DashboardPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  const [titel, setTitel] = useState(emptyTask.titel);
  const [status, setStatus] = useState<TaskStatus>(emptyTask.status);
  const [prioritaet, setPrioritaet] = useState<TaskPriority>(emptyTask.prioritaet);
  const [zustaendig, setZustaendig] = useState(emptyTask.zustaendig);
  const [faelligkeit, setFaelligkeit] = useState(emptyTask.faelligkeit);

  async function loadTasks() {
    const res = await fetch("/api/tasks", { cache: "no-store" });

    if (!res.ok) {
      console.error("Tasks konnten nicht geladen werden");
      return;
    }

    const data = await res.json();
    setTasks(data);
  }

  useEffect(() => {
    loadTasks();
  }, []);

  function openCreateModal() {
    setEditingTask(null);
    setTitel("");
    setStatus("offen");
    setPrioritaet("normal");
    setZustaendig("");
    setFaelligkeit("");
    setIsModalOpen(true);
  }

  function openEditModal(task: TaskItem) {
    setEditingTask(task);
    setTitel(task.titel);
    setStatus(task.status);
    setPrioritaet(task.prioritaet);
    setZustaendig(task.zustaendig);
    setFaelligkeit(task.faelligkeit);
    setIsModalOpen(true);
  }

  async function saveTask() {
    if (!titel.trim()) return;

    const method = editingTask ? "PATCH" : "POST";

    const body = {
      id: editingTask?.id,
      title: titel,
      status,
      priority: prioritaet,
      owner: zustaendig || "Nicht zugewiesen",
      deadline: faelligkeit || new Date().toISOString().slice(0, 10),
    };

    const res = await fetch("/api/tasks", {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("Aufgabe konnte nicht gespeichert werden");
      return;
    }

    await loadTasks();
    setIsModalOpen(false);
    setEditingTask(null);
  }

  async function deleteTask(event: MouseEvent<HTMLButtonElement>, taskId: string) {
    event.stopPropagation();

    const confirmed = window.confirm("Aufgabe wirklich löschen?");
    if (!confirmed) return;

    const res = await fetch("/api/tasks", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: taskId }),
    });

    if (!res.ok) {
      console.error("Aufgabe konnte nicht gelöscht werden");
      return;
    }

    await loadTasks();
  }

  const offene = tasks.filter((task) => task.status === "offen").length;
  const bearbeitung = tasks.filter((task) => task.status === "in Bearbeitung").length;
  const erledigt = tasks.filter((task) => task.status === "erledigt").length;

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <img className={styles.logo} src="/workpilot-logo.png" alt="WorkPilot" />
        </header>

        <nav className={styles.tabs}>
          <button className={`${styles.tab} ${styles.activeTab}`}>Dashboard</button>
          <button className={styles.tab}>Aufgaben</button>
          <button className={styles.tab}>Kalender</button>
          <button className={styles.tab}>Teams</button>
          <button className={styles.tab}>Einstellungen</button>
        </nav>

        <section className={styles.content}>
          <div className={styles.topline}>
            <div>
              <p className={styles.eyebrow}>WorkPilot</p>
              <h1>Meine Aufgaben</h1>
              <p className={styles.subline}>
                Plane, priorisiere und verfolge deine Aufgaben an einem Ort.
              </p>
            </div>

            <button className={styles.primaryButton} onClick={openCreateModal}>
              Neue Aufgabe
            </button>
          </div>

          <section className={styles.cards}>
            <article className={styles.card}>
              <span>Gesamt</span>
              <strong>{tasks.length}</strong>
            </article>

            <article className={styles.card}>
              <span>Offen</span>
              <strong>{offene}</strong>
            </article>

            <article className={styles.card}>
              <span>In Bearbeitung</span>
              <strong>{bearbeitung}</strong>
            </article>

            <article className={styles.card}>
              <span>Erledigt</span>
              <strong>{erledigt}</strong>
            </article>
          </section>

          <section className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nr.</th>
                  <th>Titel</th>
                  <th>Status</th>
                  <th>Priorität</th>
                  <th>Zuständig</th>
                  <th>Fällig</th>
                  <th>Aktion</th>
                </tr>
              </thead>

              <tbody>
                {tasks.map((task, index) => (
                  <tr
                    key={task.id}
                    onClick={() => openEditModal(task)}
                    className={styles.clickableRow}
                  >
                    <td className={styles.number}>T-{1001 + index}</td>
                    <td className={styles.title}>
                      {task.titel}
                      <span className={styles.editHint}>bearbeiten</span>
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${styles.status}`}
                        data-status={task.status}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${styles.priority}`}
                        data-priority={task.prioritaet}
                      >
                        {task.prioritaet}
                      </span>
                    </td>
                    <td>{task.zustaendig}</td>
                    <td>{task.faelligkeit}</td>
                    <td>
                      <button
                        onClick={(event) => deleteTask(event, task.id)}
                        style={{
                          border: "1px solid #fecaca",
                          background: "#fff1f2",
                          color: "#b91c1c",
                          borderRadius: "10px",
                          padding: "7px 10px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      </section>

      {isModalOpen && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2>{editingTask ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}</h2>

            <label>Titel</label>
            <input value={titel} onChange={(event) => setTitel(event.target.value)} />

            <label>Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as TaskStatus)}
            >
              <option value="offen">offen</option>
              <option value="in Bearbeitung">in Bearbeitung</option>
              <option value="erledigt">erledigt</option>
            </select>

            <label>Priorität</label>
            <select
              value={prioritaet}
              onChange={(event) => setPrioritaet(event.target.value as TaskPriority)}
            >
              <option value="niedrig">niedrig</option>
              <option value="normal">normal</option>
              <option value="hoch">hoch</option>
            </select>

            <label>Zuständig</label>
            <input
              value={zustaendig}
              onChange={(event) => setZustaendig(event.target.value)}
            />

            <label>Fälligkeitsdatum</label>
            <input
              type="date"
              value={faelligkeit}
              onChange={(event) => setFaelligkeit(event.target.value)}
            />

            <div className={styles.modalActions}>
              <button className={styles.primaryButton} onClick={saveTask}>
                Speichern
              </button>
              <button className={styles.secondaryButton} onClick={() => setIsModalOpen(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
