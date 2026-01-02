import fs from "node:fs";
import path from "node:path";
import { serve } from "bun";

// Mock data
const USERS = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Charlie" },
  { id: 4, name: "Dave" },
  { id: 5, name: "Eve" },
];

const PRODUCTS = [
  { id: 101, name: "Laptop", price: 1000 },
  { id: 102, name: "Phone", price: 500 },
  { id: 103, name: "Monitor", price: 200 },
];

const port = 3001;

console.log(`Starting server on http://localhost:${port}`);

serve({
  port,
  async fetch(req: Request) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Serve static files from playwirght-tests/app
    if (pathname === "/" || pathname === "/index.html") {
      const filePath = path.join(import.meta.dirname, "app", "index.html");
      return new Response(fs.readFileSync(filePath), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // API Routes

    // /api/fast
    if (pathname === "/api/fast") {
      return Response.json({ ok: true });
    }

    // /api/slow
    if (pathname === "/api/slow") {
      await new Promise((r) => setTimeout(r, 200));
      return Response.json({ ok: true });
    }

    // /api/error
    if (pathname === "/api/error") {
      return new Response("Error", { status: 500 });
    }

    // /api/login
    if (pathname === "/api/auth/login" || pathname === "/api/login") {
      if (req.method === "POST") {
        // Simulate randomized timing for auth if needed, or just fast
        await new Promise((r) => setTimeout(r, 100)); // Slight delay

        // Allow checking for 'fail' scenarios if needed, but for now just success
        // The tests seem to expect success mostly unless specifically testing failure.
        // Actually, `should handle failed auth attempts` implies we might need logic.
        // Let's check query params? In test-base, commonMocks didn't handle auth failure.
        // But `playwright-tests/auth.spec.ts` likely has `page.route` overrides for failures?
        // Or it sends specific data.
        // Let's assume standard success for now.
        return Response.json({
          token: "fake-jwt-token",
          user: { id: 1, name: "Test User" },
        });
      }
    }

    // /api/users
    // /api/users
    if (pathname === "/api/users") {
      if (req.method === "POST") {
        return new Response("Created", { status: 201 });
      }
      return Response.json(USERS);
    }
    // /api/users/list and /api/users/create aliases for tests
    if (pathname === "/api/users/list") {
      return Response.json(USERS);
    }
    if (pathname === "/api/users/create" && req.method === "POST") {
      return new Response("Created", { status: 201 });
    }

    // /api/users/:id
    const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
    if (userMatch) {
      const id = parseInt(userMatch[1], 10);
      const user = USERS.find((u) => u.id === id);
      return user
        ? Response.json(user)
        : new Response("Not Found", { status: 404 });
    }

    // /api/products/search
    if (pathname === "/api/products/search") {
      const q = url.searchParams.get("q")?.toLowerCase() || "";
      const results = PRODUCTS.filter((p) => p.name.toLowerCase().includes(q));
      return Response.json(results);
    }

    // /api/products/details/:id
    const productMatch = pathname.match(/^\/api\/products\/details\/(\d+)$/);
    if (productMatch) {
      const id = parseInt(productMatch[1], 10);
      const product = PRODUCTS.find((p) => p.id === id);
      return product
        ? Response.json(product)
        : new Response("Not Found", { status: 404 });
    }

    // /api/products/update (PUT)
    if (pathname === "/api/products/update" && req.method === "PUT") {
      return Response.json({ success: true });
    }

    // /api/products/:id (PUT)
    const productUpdateMatch = pathname.match(/^\/api\/products\/(\d+)$/);
    if (productUpdateMatch && req.method === "PUT") {
      return Response.json({ success: true });
    }

    // /api/random
    if (pathname === "/api/random") {
      const timeStr = url.searchParams.get("time");
      if (timeStr) {
        const time = parseInt(timeStr, 10);
        if (!Number.isNaN(time) && time > 0) {
          await new Promise((r) => setTimeout(r, time));
          return Response.json({ delayed: time });
        }
      }

      const statusStr = url.searchParams.get("status");
      if (statusStr === "error") {
        return new Response("Error", { status: 500 });
      }

      return Response.json({ ok: true });
    }

    return new Response("Not Found", { status: 404 });
  },
});
