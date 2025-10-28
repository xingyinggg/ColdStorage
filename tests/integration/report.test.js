// tests/integration/report.test.js
import { vi, describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import reportRoutes from "../../server/routes/report.js";

vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        setViewport: vi.fn(),
        setContent: vi.fn(),
        pdf: vi.fn().mockResolvedValue(Buffer.from("mock pdf")),
        evaluate: vi.fn().mockResolvedValue(true),
      }),
      close: vi.fn(),
    }),
  },
}));

const app = express();
app.use(express.json());
app.use("/report", reportRoutes);

describe("POST /report/generate-pdf", () => {
  it("should generate a PDF successfully with valid input", async () => {
    const html = "<div><h1>Test Report</h1><p>This is sample HTML content.</p></div>";
    const filename = "test_report.pdf";
    const title = "Test Report";

    const res = await request(app)
      .post("/report/generate-pdf")
      .send({ html, filename, title });

    expect(res.status).toBe(200);
    expect(res.header["content-type"]).toBe("application/pdf");
    expect(res.header["content-disposition"]).toContain(filename);
    expect(res.body).toBeInstanceOf(Buffer);
  });

  it("should return 400 if required fields are missing", async () => {
    const res = await request(app)
      .post("/report/generate-pdf")
      .send({ html: "<div>Missing fields</div>" }); // Missing filename & title

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });
});
