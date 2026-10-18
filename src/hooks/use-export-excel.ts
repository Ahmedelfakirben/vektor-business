import { useState } from "react"
import { exportDocumentsToExcelDetailed, type OutputDocumentType, type ExportDocumentHeader } from "@/lib/excel-export"
import { toast } from "sonner"

export function useExportToExcel() {
    const [isExporting, setIsExporting] = useState(false)

    const exportToExcel = async (
        table: OutputDocumentType,
        fileName: string,
        filteredData: any[]
    ) => {
        setIsExporting(true)
        try {
            await exportDocumentsToExcelDetailed(
                table,
                fileName,
                filteredData as ExportDocumentHeader[]
            )
            toast.success("Export Excel terminé avec succès")
        } catch (error: any) {
            console.error("Export Excel Erreur:", error)
            toast.error(error.message || "Erreur lors de l'export")
        } finally {
            setIsExporting(false)
        }
    }

    return { exportToExcel, isExporting }
}
