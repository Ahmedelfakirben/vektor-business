"use client"

import { Operation } from "@/hooks/use-operations"

interface CompanyInfo {
    nom: string
    adresse: string
    telephone: string
    email: string
    ice: string
}

const defaultCompany: CompanyInfo = {
    nom: "ISH Digital ALT",
    adresse: "Casablanca, Maroc",
    telephone: "+212 5XX-XXXXXX",
    email: "contact@ish-digital.ma",
    ice: "000000000000000",
}

export function generateEtatGeneralPDF(
    title: string,
    periodLabel: string,
    operations: Operation[],
    company: CompanyInfo = defaultCompany
) {
    const totalInflow = operations.filter(o => o.montant > 0).reduce((s, o) => s + o.montant, 0)
    const totalOutflow = Math.abs(operations.filter(o => o.montant < 0).reduce((s, o) => s + o.montant, 0))
    const balance = totalInflow - totalOutflow

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #333; padding: 40px; line-height: 1.4; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 3px solid #f97316; padding-bottom: 20px; }
  .company h1 { font-size: 22px; color: #f97316; margin-bottom: 5px; font-weight: 900; letter-spacing: -0.5px; }
  .company p { font-size: 10px; color: #64748b; }
  .report-info { text-align: right; }
  .report-info h2 { font-size: 18px; color: #1e293b; margin-bottom: 5px; font-weight: 800; }
  .report-info .period { font-size: 12px; color: #f97316; font-weight: 600; margin-bottom: 10px; }
  
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
  .card { padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; }
  .card .label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 5px; }
  .card .value { font-size: 16px; font-weight: 800; }
  .inflow { border-left: 4px solid #10b981; background: #f0fdf4; }
  .outflow { border-left: 4px solid #ef4444; background: #fef2f2; }
  .balance { border-left: 4px solid #f97316; background: #fff7ed; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #f8fafc; color: #475569; padding: 10px 12px; text-align: left; font-size: 9px; text-transform: uppercase; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) { background: #fafafa; }
  
  .type-badge { font-size: 8px; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
  .vente { background: #dcfce7; color: #166534; }
  .achat { background: #fee2e2; color: #991b1b; }
  .paiement { background: #fef3c7; color: #92400e; }
  .pos { background: #e0e7ff; color: #3730a3; }
  
  .amount { font-family: monospace; font-weight: 700; text-align: right; }
  .positive { color: #059669; }
  .negative { color: #dc2626; }

  .footer { margin-top: 50px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  .signature { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 40px; }
  .sig-box { text-align: center; border-top: 1px dashed #cbd5e1; width: 150px; padding-top: 10px; font-weight: 600; color: #64748b; }

  @media print { body { padding: 10px; } @page { margin: 10mm; } }
</style></head><body>
  <div class="header">
    <div class="company">
      <h1>${company.nom}</h1>
      <p>${company.adresse} · ${company.telephone}<br>ICE: ${company.ice} · ${company.email}</p>
    </div>
    <div class="report-info">
      <h2>${title}</h2>
      <div class="period">${periodLabel}</div>
      <p>Imprimé le: ${new Date().toLocaleString("fr-FR")}</p>
    </div>
  </div>

  <div class="summary">
    <div class="card inflow">
      <p class="label">Total Entrées (Ventes/Recettes)</p>
      <p class="value">${totalInflow.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</p>
    </div>
    <div class="card outflow">
      <p class="label">Total Sorties (Achats/Dépenses)</p>
      <p class="value">${totalOutflow.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</p>
    </div>
    <div class="card balance">
      <p class="label">Solde Net de la Période</p>
      <p class="value">${balance.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Réf / N°</th>
        <th>Type</th>
        <th>Tiers / Client</th>
        <th>Mode</th>
        <th style="text-align: right">Montant</th>
      </tr>
    </thead>
    <tbody>
      ${operations.map(o => `
        <tr>
          <td>${new Date(o.date).toLocaleDateString("fr-FR")}</td>
          <td><span style="color: #64748b; font-weight: 600">${o.numero || '-'}</span></td>
          <td><span class="type-badge ${o.type.toLowerCase().split(' ')[0]}">${o.type}</span></td>
          <td style="font-weight: 500">${o.tiers}</td>
          <td style="font-size: 8px; color: #64748b; text-transform: uppercase;">${o.mode_paiement || '-'}</td>
          <td class="amount ${o.montant >= 0 ? 'positive' : 'negative'}">
            ${o.montant >= 0 ? '+' : ''}${o.montant.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="signature">
    <div class="sig-box">Cachet Entreprise</div>
    <div class="sig-box">Signature Responsable</div>
  </div>

  <div class="footer">
    <p>${company.nom} - Logiciel de Gestion Commerciale ALT Digital - Document Officiel</p>
  </div>
</body></html>`

    const printWindow = window.open("", "_blank")
    if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        // Wait for fonts/styles
        setTimeout(() => {
            printWindow.print()
        }, 500)
    }
}

export function generateEtatTiersPDF(
    title: string,
    tiers: { raison_sociale?: string | null; nom?: string | null; prenom?: string | null; code?: string | null; telephone?: string | null; adresse?: string | null },
    documents: any[],
    period: { start: string; end: string },
    company: CompanyInfo = defaultCompany
) {
    const totalVolume = documents.reduce((s, doc) => s + Number(doc.montant), 0)
    
    // For general tier stat
    const isClient = title.toLowerCase().includes("client");

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #333; padding: 40px; line-height: 1.4; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 3px solid ${isClient ? '#f97316' : '#2563eb'}; padding-bottom: 20px; }
  .company h1 { font-size: 22px; color: ${isClient ? '#f97316' : '#2563eb'}; margin-bottom: 5px; font-weight: 900; letter-spacing: -0.5px; }
  .company p { font-size: 10px; color: #64748b; }
  .report-info { text-align: right; }
  .report-info h2 { font-size: 18px; color: #1e293b; margin-bottom: 5px; font-weight: 800; }
  
  .tiers-info { margin-bottom: 30px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
  .tiers-info h3 { font-size: 14px; margin-bottom: 8px; color: #1e293b; font-weight: 700; }
  .tiers-info p { font-size: 11px; color: #475569; margin-bottom: 3px; }

  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
  .card { padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; }
  .card .label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 5px; }
  .card .value { font-size: 16px; font-weight: 800; }
  .volume { border-left: 4px solid #10b981; background: #f0fdf4; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #f8fafc; color: #475569; padding: 10px 12px; text-align: left; font-size: 9px; text-transform: uppercase; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) { background: #fafafa; }
  
  .type-badge { font-size: 8px; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
  
  .amount { font-family: monospace; font-weight: 700; text-align: right; }

  .footer { margin-top: 50px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  .signature { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 40px; }
  .sig-box { text-align: center; border-top: 1px dashed #cbd5e1; width: 150px; padding-top: 10px; font-weight: 600; color: #64748b; }

  @media print { body { padding: 10px; } @page { margin: 10mm; } }
</style></head><body>
  <div class="header">
    <div class="company">
      <h1>${company.nom}</h1>
      <p>${company.adresse} &middot; ${company.telephone}<br>ICE: ${company.ice} &middot; ${company.email}</p>
    </div>
    <div class="report-info">
      <h2>${title}</h2>
      <p style="font-size:11px; margin-bottom: 5px">Période: ${period.start ? new Date(period.start).toLocaleDateString("fr-FR") : 'Début'} à ${period.end ? new Date(period.end).toLocaleDateString("fr-FR") : "Aujourd'hui"}</p>
      <p>Imprimé le: ${new Date().toLocaleString("fr-FR")}</p>
    </div>
  </div>

  <div class="tiers-info">
    <h3>${tiers.raison_sociale || `${tiers.nom} ${tiers.prenom}`}</h3>
    <p>Code: ${tiers.code || '-'}</p>
    <p>Téléphone: ${tiers.telephone || '-'}</p>
    <p>Adresse: ${tiers.adresse || '-'}</p>
  </div>

  <div class="summary">
    <div class="card volume">
      <p class="label">Volume d'affaires (TTC)</p>
      <p class="value">${totalVolume.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Document</th>
        <th>Numéro</th>
        <th style="text-align: right">Montant TTC</th>
        <th style="text-align: right">Réglé</th>
        <th style="text-align: right">Statut</th>
      </tr>
    </thead>
    <tbody>
      ${documents.map(d => {
        const estDocPayer = ["Facture/BL", "Achat/Facture"].includes(d.doc_type);
        const st = d.statut_paiement || "impaye";
        const regle = d.montant_regle || 0;
        return `
        <tr>
          <td>${new Date(d.date_val).toLocaleDateString("fr-FR")}</td>
          <td><span class="type-badge" style="background:#f1f5f9; color:#475569">${d.doc_type}</span></td>
          <td><span style="color: #64748b; font-weight: 600">${d.num || '-'}</span></td>
          <td class="amount">${Number(d.montant).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</td>
          <td class="amount" style="color: #64748b">${estDocPayer ? Number(regle).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + ' DH' : '-'}</td>
          <td style="text-align: right; font-size: 9px; font-weight: bold; text-transform: uppercase;">
             <span style="color: ${st === 'paye' ? '#166534' : st === 'partiel' ? '#9a3412' : '#991b1b'}">
                ${estDocPayer ? st : '-'}
             </span>
          </td>
        </tr>
      `}).join('')}
    </tbody>
  </table>

  <div class="signature">
    <div class="sig-box">Cachet Entreprise</div>
    <div class="sig-box">Signature Tiers</div>
  </div>

  <div class="footer">
    <p>${company.nom} - Logiciel de Gestion Commerciale ALT Digital - Document Officiel</p>
  </div>
</body></html>`

    const printWindow = window.open("", "_blank")
    if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        // Wait for fonts/styles
        setTimeout(() => {
            printWindow.print()
        }, 500)
    }
}
