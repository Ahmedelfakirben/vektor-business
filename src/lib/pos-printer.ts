"use client"

import { getCompanySettingsSync } from "@/hooks/use-company-settings"

export interface PosTicketItem {
  designation: string
  quantite: number
  prix_unitaire: number
  montant_total: number
}

export interface PosTicketData {
  companyName?: string
  companySubtitle?: string
  ticketNumero?: string
  numero?: string
  date: string
  heure?: string
  caissier?: string
  client?: string
  modePaiement: string
  lignes: PosTicketItem[]
  totalTTC: number
  totalInitial?: number
  remise?: number
  montantRecu?: number
  monnaieRendue?: number
  notes?: string
}

export interface ClotureArticleItem {
  designation: string
  quantite: number
  total: number
  vendeur?: string
}

export interface ClotureUserGroup {
  userName: string
  totalArticles: number
  totalMontant: number
  articles: ClotureArticleItem[]
}

export interface PosClotureData {
  companyName?: string
  titre?: string
  dateCloture?: string
  periodeLabel?: string
  periode?: string
  caissier: string
  nombreVentes?: number
  totalVentes?: number
  totalGeneral: number
  modesPaiement?: {
    label: string
    code?: string
    count: number
    total: number
  }[]
  modes?: {
    mode: string
    montant: number
    count: number
  }[]
  articlesGroupedByUser: ClotureUserGroup[]
  articlesSummary: ClotureArticleItem[]
}

/**
 * Print a standard thermal receipt (80mm) without printing the web application interface.
 * Uses a hidden iframe with ESC/POS standard formatting.
 */
export function printPosTicket(data: PosTicketData) {
  const printIframe = document.createElement("iframe")
  printIframe.style.position = "fixed"
  printIframe.style.right = "0"
  printIframe.style.bottom = "0"
  printIframe.style.width = "0"
  printIframe.style.height = "0"
  printIframe.style.border = "0"
  document.body.appendChild(printIframe)

  const doc = printIframe.contentWindow?.document
  if (!doc) return

  const ticketNum = data.ticketNumero || data.numero || "TICKET"
  const formattedDate = new Date(data.date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const formattedTime = data.heure || new Date(data.date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Ticket ${ticketNum}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          @media print {
            body {
              width: 72mm;
              margin: 0 auto;
              padding: 5mm 0;
            }
          }
          body {
            font-family: 'Courier New', Courier, monospace, sans-serif;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
            background: #fff;
            width: 72mm;
            margin: 0 auto;
            padding: 4mm;
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .font-black { font-weight: 900; }
          .uppercase { text-transform: uppercase; }
          
          .header {
            text-align: center;
            padding-bottom: 6px;
            border-bottom: 1px dashed #000;
            margin-bottom: 6px;
          }
          .company-name {
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 1px;
            margin: 0;
          }
          .subtitle {
            font-size: 9px;
            color: #333;
            margin-top: 2px;
          }
          .info-table {
            width: 100%;
            margin-bottom: 6px;
            font-size: 10px;
          }
          .info-table td {
            padding: 1px 0;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 6px 0;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 4px 0;
          }
          .items-table th {
            font-size: 9px;
            text-transform: uppercase;
            padding: 4px 0;
            border-bottom: 1px dashed #444;
          }
          .items-table td {
            padding: 3px 0;
            vertical-align: top;
          }
          .item-row {
            margin-bottom: 3px;
          }
          .item-desc {
            font-weight: bold;
            font-size: 11px;
          }
          .item-sub {
            font-size: 10px;
            color: #333;
          }

          .totals-table {
            width: 100%;
            margin-top: 4px;
            font-size: 11px;
          }
          .totals-table td {
            padding: 2px 0;
          }
          .total-highlight {
            font-size: 14px;
            font-weight: 900;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 4px 0 !important;
          }
          
          .footer {
            text-align: center;
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px dashed #000;
            font-size: 9px;
          }
          .barcode-line {
            font-family: 'Courier New', monospace;
            letter-spacing: 4px;
            font-weight: bold;
            margin-top: 6px;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="company-name">${data.companyName || getCompanySettingsSync().nom || "LINVENTORY"}</h1>
          ${getCompanySettingsSync().adresse ? `<p class="subtitle">${getCompanySettingsSync().adresse}</p>` : `<p class="subtitle">${data.companySubtitle || "Point de Vente & Gestion Commerciale"}</p>`}
          ${getCompanySettingsSync().telephone ? `<p class="subtitle">Tél: ${getCompanySettingsSync().telephone}</p>` : ""}
          ${getCompanySettingsSync().ice ? `<p class="subtitle">ICE: ${getCompanySettingsSync().ice}</p>` : ""}
          <p style="margin: 4px 0 0 0; font-size: 10px; font-weight: bold;">TICKET DE CAISSE</p>
        </div>

        <table class="info-table">
          <tr>
            <td class="text-left font-bold">Ticket N°:</td>
            <td class="text-right font-black">${ticketNum}</td>
          </tr>
          <tr>
            <td class="text-left">Date & Heure:</td>
            <td class="text-right">${formattedDate} ${formattedTime}</td>
          </tr>
          ${data.caissier ? `
          <tr>
            <td class="text-left">Caissier:</td>
            <td class="text-right font-bold">${data.caissier}</td>
          </tr>` : ""}
          <tr>
            <td class="text-left">Client:</td>
            <td class="text-right font-bold">${data.client || "Comptoir"}</td>
          </tr>
          <tr>
            <td class="text-left">Règlement:</td>
            <td class="text-right font-bold">${data.modePaiement}</td>
          </tr>
        </table>

        <table class="items-table">
          <thead>
            <tr>
              <th class="text-left" style="width: 55%;">Désignation</th>
              <th class="text-center" style="width: 20%;">Qté x P.U</th>
              <th class="text-right" style="width: 25%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.lignes.map(l => `
              <tr>
                <td colspan="3" class="item-desc" style="padding-top: 4px;">
                  ${l.designation}
                </td>
              </tr>
              <tr>
                <td class="text-left" style="font-size: 9px; color: #555; padding-bottom: 4px;">
                  Ref: ART-${l.quantite}
                </td>
                <td class="text-center item-sub" style="padding-bottom: 4px;">
                  ${l.quantite} x ${Number(l.prix_unitaire).toFixed(2)}
                </td>
                <td class="text-right font-bold" style="padding-bottom: 4px;">
                  ${Number(l.montant_total).toFixed(2)} DH
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <table class="totals-table">
          ${data.remise && data.remise > 0 ? `
          <tr>
            <td class="text-left" style="font-size: 10px; color: #555;">Sous-Total :</td>
            <td class="text-right" style="font-size: 10px; color: #555;">${Number(data.totalInitial || (data.totalTTC + data.remise)).toFixed(2)} DH</td>
          </tr>
          <tr style="font-weight: bold; color: #000;">
            <td class="text-left">Remise / Réduction :</td>
            <td class="text-right">-${Number(data.remise).toFixed(2)} DH</td>
          </tr>
          ` : ""}
          <tr class="total-highlight">
            <td class="text-left">TOTAL PAYÉ</td>
            <td class="text-right">${Number(data.totalTTC).toFixed(2)} DH</td>
          </tr>
          <tr>
            <td class="text-left" style="font-size: 9px; color: #555;">Nombre d'articles:</td>
            <td class="text-right" style="font-size: 9px; font-weight: bold;">
              ${data.lignes.reduce((sum, l) => sum + Number(l.quantite), 0)} article(s)
            </td>
          </tr>
        </table>

        ${data.notes ? `
          <div style="font-size: 9px; margin-top: 6px; border-top: 1px dashed #ddd; padding-top: 4px;">
            <strong>Note:</strong> ${data.notes}
          </div>
        ` : ""}

        <div class="footer">
          <div class="barcode-line">*${ticketNum.replace(/[^A-Z0-9]/gi, "")}*</div>
          <p style="margin: 4px 0 2px 0; font-size: 10px; font-weight: bold;">Merci de votre visite et à bientôt !</p>
          <p style="margin: 0; font-size: 8px; color: #666;">Les articles achetés peuvent être échangés sous 48h avec ticket.</p>
        </div>
      </body>
    </html>
  `

  doc.open()
  doc.write(html)
  doc.close()

  printIframe.contentWindow?.focus()
  setTimeout(() => {
    printIframe.contentWindow?.print()
    setTimeout(() => {
      document.body.removeChild(printIframe)
    }, 1000)
  }, 300)
}

/**
 * Print a standard thermal receipt for Cash Register Closing (Clôture de Caisse),
 * including detailed item breakdown and salesperson attribution.
 */
export function printPosCloture(data: PosClotureData) {
  const printIframe = document.createElement("iframe")
  printIframe.style.position = "fixed"
  printIframe.style.right = "0"
  printIframe.style.bottom = "0"
  printIframe.style.width = "0"
  printIframe.style.height = "0"
  printIframe.style.border = "0"
  document.body.appendChild(printIframe)

  const doc = printIframe.contentWindow?.document
  if (!doc) return

  const periode = data.periodeLabel || data.periode || "Aujourd'hui"
  const dateCloture =
    data.dateCloture ||
    new Date().toLocaleDateString("fr-FR") +
      " à " +
      new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  const nbrVentes = data.nombreVentes ?? data.totalVentes ?? 0
  const paymentModes =
    data.modesPaiement ||
    (data.modes || []).map((m) => ({
      label: m.mode,
      count: m.count,
      total: m.montant,
    }))

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Cloture de Caisse - ${periode}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          @media print {
            body {
              width: 72mm;
              margin: 0 auto;
              padding: 5mm 0;
            }
          }
          body {
            font-family: 'Courier New', Courier, monospace, sans-serif;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
            background: #fff;
            width: 72mm;
            margin: 0 auto;
            padding: 4mm;
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .font-black { font-weight: 900; }
          .uppercase { text-transform: uppercase; }

          .header {
            text-align: center;
            padding-bottom: 6px;
            border-bottom: 1px dashed #000;
            margin-bottom: 6px;
          }
          .company-name {
            font-size: 15px;
            font-weight: 900;
            margin: 0;
          }
          .ticket-title {
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            margin: 3px 0 0 0;
          }

          .section-title {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            margin: 8px 0 4px 0;
          }

          .info-table, .totals-table, .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          .info-table td, .totals-table td {
            padding: 1.5px 0;
          }
          
          .items-table th {
            font-size: 9px;
            text-transform: uppercase;
            border-bottom: 1px dashed #000;
            padding: 3px 0;
          }
          .items-table td {
            padding: 2.5px 0;
          }

          .user-header {
            font-weight: 900;
            font-size: 10px;
            background: #f0f0f0;
            padding: 2px 4px;
            margin-top: 4px;
            border-left: 2px solid #000;
          }

          .highlight-row {
            font-size: 12px;
            font-weight: 900;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 4px 0 !important;
          }

          .signatures {
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1px dashed #000;
            font-size: 9px;
          }
          .sign-box {
            display: flex;
            justify-content: space-between;
            margin-top: 15px;
          }
          .sign-line {
            border-bottom: 1px solid #000;
            width: 90px;
            margin-top: 25px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="company-name">${data.companyName || getCompanySettingsSync().nom || "LINVENTORY POS"}</h1>
          <p class="ticket-title">${data.titre || "TICKET DE CLÔTURE DE CAISSE"}</p>
          <p style="font-size: 9px; color: #555; margin: 2px 0 0 0;">
            Imprimé le ${dateCloture}
          </p>
        </div>

        <table class="info-table">
          <tr>
            <td class="text-left">Période:</td>
            <td class="text-right font-bold">${periode}</td>
          </tr>
          <tr>
            <td class="text-left">Caissier / Filtre:</td>
            <td class="text-right font-bold">${data.caissier}</td>
          </tr>
          <tr>
            <td class="text-left">Nombre de Ventes:</td>
            <td class="text-right font-black">${nbrVentes} tickets</td>
          </tr>
        </table>

        <!-- MODES DE PAIEMENT -->
        <div class="section-title">1. Encaissements par Règlement</div>
        <table class="totals-table">
          ${paymentModes.map(m => `
            <tr>
              <td class="text-left">${m.label} (${m.count})</td>
              <td class="text-right font-bold">${Number(m.total).toFixed(2)} DH</td>
            </tr>
          `).join("")}
          <tr class="highlight-row">
            <td class="text-left">TOTAL GÉNÉRAL ENCAISSÉ</td>
            <td class="text-right">${Number(data.totalGeneral).toFixed(2)} DH</td>
          </tr>
        </table>

        <!-- DESGLOSE POR USUARIO / VENDEDOR -->
        <div class="section-title">2. Ventes par Vendeur (Utilisateur)</div>
        ${data.articlesGroupedByUser.length === 0 ? `
          <p style="font-size: 9px; color: #777; font-style: italic;">Aucune vente sur cette période.</p>
        ` : data.articlesGroupedByUser.map(u => `
          <div class="user-header">
            👤 ${u.userName} — ${u.totalArticles} art. | ${Number(u.totalMontant).toFixed(2)} DH
          </div>
          <table class="items-table" style="margin-bottom: 6px;">
            ${u.articles.map(art => `
              <tr>
                <td class="text-left" style="width: 55%; font-size: 9px;">• ${art.designation}</td>
                <td class="text-center" style="width: 15%; font-size: 9px;">x${art.quantite}</td>
                <td class="text-right font-bold" style="width: 30%; font-size: 9px;">${Number(art.total).toFixed(2)} DH</td>
              </tr>
            `).join("")}
          </table>
        `).join("")}

        <!-- DESGLOSE GLOBAL DE ARTÍCULOS VENDIDOS -->
        <div class="section-title">3. Récapitulatif Global des Articles</div>
        <table class="items-table">
          <thead>
            <tr>
              <th class="text-left" style="width: 48%;">Article</th>
              <th class="text-center" style="width: 14%;">Qté</th>
              <th class="text-right" style="width: 20%;">Total</th>
              <th class="text-right" style="width: 18%;">Vendeur</th>
            </tr>
          </thead>
          <tbody>
            ${data.articlesSummary.map(a => `
              <tr>
                <td class="text-left" style="font-size: 9px; font-weight: bold;">${a.designation}</td>
                <td class="text-center font-black" style="font-size: 9px;">${a.quantite}</td>
                <td class="text-right font-bold" style="font-size: 9px;">${Number(a.total).toFixed(2)}</td>
                <td class="text-right" style="font-size: 8px; color: #555;">${a.vendeur || "—"}</td>
              </tr>
            `).join("")}
            <tr style="border-top: 1px dashed #000; font-weight: bold;">
              <td class="text-left" style="padding-top: 3px;">TOTAL QUANTITÉ</td>
              <td class="text-center font-black" style="padding-top: 3px;">
                ${data.articlesSummary.reduce((s, a) => s + Number(a.quantite), 0)}
              </td>
              <td class="text-right font-black" style="padding-top: 3px;">
                ${data.articlesSummary.reduce((s, a) => s + Number(a.total), 0).toFixed(2)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <!-- SIGNATURES -->
        <div class="signatures">
          <div class="sign-box">
            <div>
              <strong>Visa Caissier:</strong>
              <div class="sign-line"></div>
            </div>
            <div>
              <strong>Visa Responsable:</strong>
              <div class="sign-line"></div>
            </div>
          </div>
          <p class="text-center" style="margin-top: 15px; font-size: 8px; color: #777;">
            Certifié sincère et conforme aux enregistrements de la caisse.
          </p>
        </div>
      </body>
    </html>
  `

  doc.open()
  doc.write(html)
  doc.close()

  printIframe.contentWindow?.focus()
  setTimeout(() => {
    printIframe.contentWindow?.print()
    setTimeout(() => {
      document.body.removeChild(printIframe)
    }, 1000)
  }, 300)
}

export interface PosRetourTicketData {
  companyName?: string
  companySubtitle?: string
  ticketNumero: string
  date: string
  heure?: string
  caissier?: string
  client?: string
  modeRemboursement: string
  motif?: string
  lignes: PosTicketItem[]
  totalRembourse: number
}

export function printPosRetourTicket(data: PosRetourTicketData) {
  const existingFrame = document.getElementById("pos-print-iframe")
  if (existingFrame) {
    existingFrame.remove()
  }

  const printIframe = document.createElement("iframe")
  printIframe.id = "pos-print-iframe"
  printIframe.style.position = "fixed"
  printIframe.style.right = "0"
  printIframe.style.bottom = "0"
  printIframe.style.width = "0"
  printIframe.style.height = "0"
  printIframe.style.border = "0"
  document.body.appendChild(printIframe)

  const doc = printIframe.contentDocument || printIframe.contentWindow?.document
  if (!doc) return

  const dateFormatted = new Date(data.date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const timeFormatted = data.heure || new Date(data.date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ticket de Retour - ${data.ticketNumero}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 72mm;
            margin: 0 auto;
            padding: 8px 4px 16px 4px;
            color: #000;
            background: #fff;
            font-size: 11px;
            line-height: 1.25;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .font-black { font-weight: 900; }
          .border-top { border-top: 1px dashed #000; }
          .border-bottom { border-bottom: 1px dashed #000; }
          .py-1 { padding-top: 3px; padding-bottom: 3px; }
          .header { text-align: center; margin-bottom: 8px; }
          .company-name { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; }
          .badge-retour {
            display: inline-block;
            border: 1px solid #000;
            padding: 2px 6px;
            font-weight: 900;
            margin: 4px 0;
            font-size: 12px;
          }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10px; }
          th { font-size: 9px; font-weight: 900; padding: 3px 0; text-transform: uppercase; }
          td { padding: 2px 0; }
          .total-box { margin-top: 6px; padding-top: 4px; font-size: 13px; font-weight: 900; }
        </style>
      </head>
      <body>
        <div class="header border-bottom py-1">
          <div class="company-name">${data.companyName || getCompanySettingsSync().nom || "LINVENTORY"}</div>
          ${getCompanySettingsSync().adresse ? `<div style="font-size: 9px;">${getCompanySettingsSync().adresse}</div>` : ""}
          <div class="badge-retour">*** TICKET DE RETOUR / AVOIR ***</div>
          <div class="font-bold">N° : ${data.ticketNumero}</div>
          <div style="font-size: 9px;">Date : ${dateFormatted} à ${timeFormatted}</div>
        </div>

        <div class="border-bottom py-1" style="font-size: 10px;">
          <div><strong>Client :</strong> ${data.client || "Comptoir"}</div>
          ${data.caissier ? `<div><strong>Caissier :</strong> ${data.caissier}</div>` : ""}
          <div><strong>Mode Remboursement :</strong> ${data.modeRemboursement}</div>
          ${data.motif ? `<div><strong>Motif :</strong> ${data.motif}</div>` : ""}
        </div>

        <table>
          <thead>
            <tr class="border-bottom">
              <th align="left">Article retourné</th>
              <th align="center">Qté x P.U</th>
              <th align="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.lignes
              .map(
                (l) => `
              <tr>
                <td colspan="3" class="font-bold">${l.designation}</td>
              </tr>
              <tr class="border-bottom" style="font-size: 9.5px;">
                <td style="padding-left: 6px;">${l.quantite} unité(s)</td>
                <td align="center">${Number(l.prix_unitaire).toFixed(2)} DH</td>
                <td align="right" class="font-bold">${Number(l.montant_total).toFixed(2)} DH</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div class="total-box border-bottom py-1">
          <table style="font-size: 13px;">
            <tr>
              <td><strong>TOTAL REMBOURSÉ :</strong></td>
              <td align="right"><strong>${Number(data.totalRembourse).toFixed(2)} DH</strong></td>
            </tr>
          </table>
        </div>

        <div class="text-center py-1" style="margin-top: 6px; font-size: 9px;">
          <div>Articles réintégrés en stock.</div>
          <div style="margin-top: 4px;">Merci de votre confiance !</div>
        </div>
      </body>
    </html>
  `

  doc.open()
  doc.write(html)
  doc.close()

  printIframe.contentWindow?.focus()
  setTimeout(() => {
    printIframe.contentWindow?.print()
    setTimeout(() => {
      document.body.removeChild(printIframe)
    }, 1000)
  }, 300)
}
