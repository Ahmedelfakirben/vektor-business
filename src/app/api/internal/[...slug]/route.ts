import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const path = req.nextUrl.pathname;
    const timestamp = new Date().toISOString();

    console.warn(`[SECURITY CANARY TRIGGERED] Honeytoken endpoint (${path}) probed by IP: ${ip} | UA: ${userAgent} | Timestamp: ${timestamp}`);

    return NextResponse.json(
        {
            status: "active_monitoring",
            message: "Este endpoint forma parte del sistema de deteccion de intrusiones de Vektor Labs.",
            notice: "Tu direccion IP, cabeceras y contexto de peticion han sido registrados para analisis forense.Mensaje importante : Si eres el Compañero de Borja y ves esto Muchas Gracias de todo corazon ! Para divulgacion responsable, contacta a ahmed@elfakir.com",
            incident_tracking_id: `VL-SEC-${Date.now().toString(36).toUpperCase()}`,
            responsible_disclosure: "ahmed@elfakir.com"
        },
        {
            status: 200,
            headers: {
                "X-Security-Monitoring": "Active (Canary Triggered)",
                "X-Responsible-Disclosure": "mailto:ahmed@elfakir.com",
                "X-Architecture": "Cryptographically Isolated Multi-Tenant Enterprise Tier"
            }
        }
    );
}

export async function POST(req: NextRequest) {
    return GET(req);
}
