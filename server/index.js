import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables first
dotenv.config({ path: path.join(__dirname, ".env") });

// Add debug logging
// console.log('Loading environment variables...');
// console.log('Current directory:', __dirname);
// console.log('Looking for .env at:', path.join(__dirname, '.env'));
// console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'Missing');
// console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Found' : 'Missing');

// Dynamic imports AFTER env variables are loaded
const authRoutes = (await import("./routes/auth.js")).default;
const taskRoutes = (await import("./routes/tasks.js")).default;
const projectsRouter = (await import("./routes/projects.js")).default;
const managerProjectsRouter = (await import("./routes/manager-projects.js"))
  .default;
const hrRoutes = (await import("./routes/hr.js")).default;
const usersRoutes = (await import("./routes/users.js")).default;
const notificationRoutes = (await import("./routes/notification.js")).default;
const directorRoutes = (await import("./routes/director.js")).default;

// // Import routes AFTER loading env variables
// import authRoutes from './routes/auth.js';
// import taskRoutes from './routes/tasks.js';
// import projectsRouter from './routes/projects.js';
// import hrRoutes from './routes/hr.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/tasks", taskRoutes);
app.use("/projects", projectsRouter);
app.use("/manager-projects", managerProjectsRouter);
app.use("/hr", hrRoutes);
app.use("/users", usersRoutes);
app.use("/notification", notificationRoutes);
app.use("/director", directorRoutes);

app.use((req, res) => res.status(404).type("application/json").send(JSON.stringify({ error: "Not found" })));


const port = process.env.PORT || 4000;
app.listen(port, () =>
  console.log(`Express API listening on http://localhost:${port}`)
);

app.get("/", (req, res) => {
  res.json({ message: "Server is running!" });
});

app.get("/test", (req, res) => {
  res.json({ message: "Test route works!" });
});
