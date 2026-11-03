import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Make .env.local values available to the functions
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  const plugins = [react()];

  // ONLY add the local API middleware if we are in development mode
  if (mode === "development") {
    plugins.push({
      name: "local-api",
      configureServer(server) {
        server.middlewares.use("/api", async (req, res) => {
          try {
            const url = new URL(req.url, "http://localhost");
            const name = url.pathname.replace("/", "").replace(/[^a-z0-9-]/gi, "");
            req.query = Object.fromEntries(url.searchParams);

            if (req.method === "POST") {
              let body = "";
              for await (const chunk of req) body += chunk;
              req.body = body ? JSON.parse(body) : {};
            } else {
              req.body = {};
            }

            res.status = (code) => {
              res.statusCode = code;
              return res;
            };
            res.json = (data) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(data));
            };

            const { default: handler } = await server.ssrLoadModule(`/api/${name}.js`);
            await handler(req, res);
          } catch (err) {
            console.error(err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Local API error. Check the terminal." }));
          }
        });
      },
    });
  }

  return { plugins };
});