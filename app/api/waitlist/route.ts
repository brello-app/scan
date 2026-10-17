import { randomUUID } from "node:crypto";
import { waitlistFormSchema } from "@/lib/waitlist-schema";

function getErrorDetail(error: unknown) {
  if (!(error instanceof Error)) return String(error);

  const cause = error.cause;
  if (cause instanceof Error) {
    return `${error.name}: ${error.message} (cause: ${cause.message})`;
  }

  if (cause && typeof cause === "object" && "code" in cause) {
    return `${error.name}: ${error.message} (code: ${String(cause.code)})`;
  }

  return `${error.name}: ${error.message}`;
}

function responsePreview(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 400);
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  console.info(`[waitlist:${requestId}] Received submission.`);

  const endpoint = process.env.NEXT_PUBLIC_WAITLIST_URL;

  if (!endpoint) {
    console.error(`[waitlist:${requestId}] NEXT_PUBLIC_WAITLIST_URL is not configured.`);
    return Response.json(
      { error: "Could not join the waitlist. Please try again." },
      { status: 503 },
    );
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    console.error(`[waitlist:${requestId}] The configured endpoint URL is invalid.`);
    return Response.json(
      { error: "Could not join the waitlist. Please try again." },
      { status: 500 },
    );
  }

  if (url.protocol !== "https:" || url.hostname !== "script.google.com") {
    console.error(
      `[waitlist:${requestId}] Unexpected endpoint host or protocol: ${url.protocol}//${url.host}`,
    );
    return Response.json(
      { error: "Could not join the waitlist. Please try again." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    console.error(
      `[waitlist:${requestId}] Request body was not valid JSON:`,
      getErrorDetail(error),
    );
    return Response.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const submission = waitlistFormSchema.safeParse(body);
  if (!submission.success) {
    console.error(
      `[waitlist:${requestId}] Form validation failed:`,
      submission.error.issues.map(({ path, code }) => ({ path, code })),
    );
    return Response.json({ error: "Invalid form submission." }, { status: 400 });
  }

  try {
    const startedAt = Date.now();
    console.info(`[waitlist:${requestId}] Forwarding submission to Apps Script.`);
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(submission.data),
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const responseText = await upstream.text();
    const responseDetail = responsePreview(responseText) || "<empty response>";
    console.info(`[waitlist:${requestId}] Apps Script responded.`, {
      status: upstream.status,
      statusText: upstream.statusText,
      durationMs: Date.now() - startedAt,
      contentType: upstream.headers.get("content-type"),
      body: responseDetail,
    });

    if (!upstream.ok) {
      console.error(
        `[waitlist:${requestId}] Apps Script rejected the submission.`,
      );
      return Response.json(
        { error: "Could not join the waitlist. Please try again." },
        { status: 502 },
      );
    }

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      parsedResponse = undefined;
    }

    const parsedRecord =
      parsedResponse && typeof parsedResponse === "object"
        ? (parsedResponse as { ok?: unknown; success?: unknown })
        : undefined;
    const isHtmlResponse = upstream.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("text/html");

    if (
      isHtmlResponse ||
      parsedRecord?.ok === false ||
      parsedRecord?.success === false
    ) {
      console.error(
        `[waitlist:${requestId}] Apps Script returned a response that indicates failure.`,
      );
      return Response.json(
        { error: "Could not join the waitlist. Please try again." },
        { status: 502 },
      );
    }

    console.info(`[waitlist:${requestId}] Submission accepted.`);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`[waitlist:${requestId}] Could not reach Apps Script:`, {
      detail: getErrorDetail(error),
      error,
    });
    return Response.json(
      { error: "Could not join the waitlist. Please try again." },
      { status: 502 },
    );
  }
}
