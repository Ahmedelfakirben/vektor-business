"use client"

import type { Devis, BonLivraison, BonRetour, BonCommande, BonAchat, BonRetourAchat } from "@/types/database"

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

type DocumentData = {
    type: "devis" | "bon_livraison" | "bon_retour" | "bon_commande" | "bon_achat" | "bon_retour_achat"
    numero: string
    date: string
    tiers: { raison_sociale: string; code: string; adresse?: string | null; telephone?: string | null; ice?: string | null }
    lignes: Array<{ designation: string; quantite: number; prix_unitaire: number; tva: number; montant_ht: number }>
    montant_ht: number
    montant_tva: number
    montant_ttc: number
    inclure_tva?: boolean
    notes?: string | null
    extra?: Record<string, string>
}

const typeLabels: Record<string, string> = {
    devis: "DEVIS", bon_livraison: "BON DE LIVRAISON", bon_retour: "BON DE RETOUR",
    bon_commande: "BON DE COMMANDE", bon_achat: "BON D'ACHAT", bon_retour_achat: "BON DE RETOUR ACHAT",
}

export function generateDocumentPDF(doc: DocumentData, company: CompanyInfo = defaultCompany) {
    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${typeLabels[doc.type]} ${doc.numero}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; padding: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 3px solid #1a56db; padding-bottom: 20px; }
  .company { max-width: 300px; }
  .company h1 { font-size: 20px; color: #1a56db; margin-bottom: 5px; }
  .company p { font-size: 11px; color: #666; line-height: 1.6; }
  .doc-info { text-align: right; }
  .doc-info h2 { font-size: 18px; color: #1a56db; margin-bottom: 8px; }
  .doc-info p { font-size: 11px; color: #666; }
  .tiers { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 25px; }
  .tiers h3 { font-size: 11px; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; }
  .tiers p { line-height: 1.6; }
  .tiers .name { font-weight: 600; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
  th { background: #1a56db; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f8fafc; }
  .text-right { text-align: right; }
  .totals { display: flex; justify-content: flex-end; }
  .totals-table { width: 280px; }
  .totals-table td { padding: 6px 12px; }
  .totals-table .total-ttc { font-size: 16px; font-weight: 700; color: #1a56db; border-top: 2px solid #1a56db; }
  .notes { margin-top: 20px; padding: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; font-size: 11px; }
  .notes h4 { font-weight: 600; margin-bottom: 4px; }
  .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
  ${doc.extra ? Object.entries(doc.extra).map(() => '').join('') : ''}
  @media print { body { padding: 20px; } @page { margin: 15mm; } }
</style></head><body>
  <div class="header">
    <div class="company">
      <h1>${company.nom}</h1>
      <p>${company.adresse}<br>${company.telephone}<br>${company.email}<br>ICE: ${company.ice}</p>
    </div>
    <div class="doc-info">
      <h2>${typeLabels[doc.type]}</h2>
      <p><strong>N°:</strong> ${doc.numero}<br><strong>Date:</strong> ${new Date(doc.date).toLocaleDateString("fr-FR")}</p>
      ${doc.extra ? Object.entries(doc.extra).map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join('') : ''}
    </div>
  </div>
  <div class="tiers">
    <h3>${doc.type.includes("achat") || doc.type === "bon_commande" ? "Fournisseur" : "Client"}</h3>
    <p class="name">${doc.tiers.raison_sociale}</p>
    <p>Code: ${doc.tiers.code}${doc.tiers.adresse ? `<br>${doc.tiers.adresse}` : ''}${doc.tiers.telephone ? `<br>Tél: ${doc.tiers.telephone}` : ''}${doc.tiers.ice ? `<br>ICE: ${doc.tiers.ice}` : ''}</p>
  </div>
  <table>
    <thead><tr><th>Désignation</th><th class="text-right">Qté</th><th class="text-right">P.U.</th><th class="text-right">Montant Total</th></tr></thead>
    <tbody>
      ${doc.lignes.map(l => `<tr><td>${l.designation}</td><td class="text-right">${l.quantite}</td><td class="text-right">${Number(l.prix_unitaire).toFixed(2)}</td><td class="text-right">${Number(l.montant_ht).toFixed(2)}</td></tr>`).join('')}
    </tbody>
  </table>
  <div class="totals"><table class="totals-table">
    <tr><td class="total-ttc">Total à Payer</td><td class="text-right total-ttc">${Number(doc.montant_ttc).toFixed(2)} MAD</td></tr>
  </table></div>
  ${doc.notes ? `<div class="notes"><h4>Notes</h4><p>${doc.notes}</p></div>` : ''}
  <div class="footer"><p>${company.nom} · ${company.adresse} · ${company.telephone}</p></div>
</body></html>`

    const printWindow = window.open("", "_blank")
    if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.onload = () => printWindow.print()
    }
}
