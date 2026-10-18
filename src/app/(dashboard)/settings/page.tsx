"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User, Building, Save, Loader2, ReceiptText, CheckCircle2, Camera } from "lucide-react"
import { toast } from "sonner"
import { useFiscalMode } from "@/providers/fiscal-mode-context"
import { useCompanySettings, DEFAULT_COMPANY_INFO } from "@/hooks/use-company-settings"

export default function SettingsPage() {
    const supabase = createClient()
    const { fiscalMode, toggleFiscalMode } = useFiscalMode()
    const { company: savedCompany, saveCompany, isSaving: savingCompany } = useCompanySettings()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [profile, setProfile] = useState({ nom: "", prenom: "", email: "", role: "" })
    const [company, setCompany] = useState(DEFAULT_COMPANY_INFO)

    useEffect(() => {
        async function loadProfile() {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single() as any
                if (data) setProfile({ nom: data.nom, prenom: data.prenom, email: data.email, role: data.role })
            }
            setLoading(false)
        }
        loadProfile()
    }, [])

    const handleSaveProfile = async () => {
        setSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Non connecté")
            const { error } = await (supabase.from("profiles") as any).update({ nom: profile.nom, prenom: profile.prenom }).eq("user_id", user.id)
            if (error) throw error
            toast.success("Profil mis à jour")
        } catch { toast.error("Erreur lors de la sauvegarde") }
        setSaving(false)
    }

    useEffect(() => {
        if (savedCompany) {
            setCompany(savedCompany)
        }
    }, [savedCompany])

    const handleSaveCompany = async () => {
        try {
            await saveCompany(company)
            toast.success("Informations société sauvegardées avec succès !")
        } catch {
            toast.error("Erreur lors de la sauvegarde")
        }
    }

    const roleLabels: Record<string, string> = { admin: "Administrateur", gerant: "Gérant", commercial: "Commercial", magasinier: "Magasinier" }

    if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>

    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Paramètres</h2><p className="text-muted-foreground">Gérez votre profil et les paramètres de l&apos;application</p></div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2"><User className="h-5 w-5" /><CardTitle>Profil utilisateur</CardTitle></div>
                    <CardDescription>Informations de votre compte</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div><Label>Nom</Label><Input value={profile.nom} onChange={(e) => setProfile({ ...profile, nom: e.target.value })} /></div>
                        <div><Label>Prénom</Label><Input value={profile.prenom} onChange={(e) => setProfile({ ...profile, prenom: e.target.value })} /></div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div><Label>Email</Label><Input value={profile.email} disabled className="bg-muted" /></div>
                        <div><Label>Rôle</Label><div className="mt-2"><Badge variant="outline">{roleLabels[profile.role] || profile.role}</Badge></div></div>
                    </div>
                    <Button onClick={handleSaveProfile} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Sauvegarder le profil</Button>
                </CardContent>
            </Card>

            <Separator />

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2"><Building className="h-5 w-5" /><CardTitle>Informations société</CardTitle></div>
                    <CardDescription>Ces informations apparaissent sur les tickets de caisse POS et les documents PDF générés</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div><Label>Nom de la société</Label><Input value={company.nom} onChange={(e) => setCompany({ ...company, nom: e.target.value })} /></div>
                        <div><Label>ICE</Label><Input value={company.ice} onChange={(e) => setCompany({ ...company, ice: e.target.value })} /></div>
                    </div>
                    <div><Label>Adresse</Label><Input value={company.adresse} onChange={(e) => setCompany({ ...company, adresse: e.target.value })} /></div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div><Label>Téléphone</Label><Input value={company.telephone} onChange={(e) => setCompany({ ...company, telephone: e.target.value })} /></div>
                        <div><Label>Email</Label><Input value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} /></div>
                    </div>
                    <Button onClick={handleSaveCompany} disabled={savingCompany}>
                        {savingCompany ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Sauvegarder les informations société
                    </Button>
                </CardContent>
            </Card>



            <Separator />
            <VisualRecognitionSettingsSection />
            <Separator />
            <AdminManagement profileEmail={profile.email} />
            <Separator />
            <DataManagement />
        </div>
    )
}

function VisualRecognitionSettingsSection() {
    const [isSyncing, setIsSyncing] = useState(false)
    const [cachedCount, setCachedCount] = useState<number | null>(null)

    useEffect(() => {
        async function fetchStatus() {
            try {
                const res = await fetch("/api/articles/signature")
                const data = await res.json()
                if (data.total_in_cache !== undefined) {
                    setCachedCount(data.total_in_cache)
                }
            } catch (e) {
                console.error("Erreur statut vision:", e)
            }
        }
        fetchStatus()
    }, [])

    const handleSync = async () => {
        setIsSyncing(true)
        try {
            const res = await fetch("/api/articles/signature")
            const data = await res.json()
            if (data.success) {
                setCachedCount(data.total_in_cache)
                toast.success(`Indexation réussie : ${data.total_in_cache} articles prêts pour la reconnaissance au TPV`)
            } else {
                toast.error(data.error || "Erreur lors de la synchronisation")
            }
        } catch {
            toast.error("Impossible de joindre le service de synchronisation")
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <Card className="border-emerald-500/20 shadow-xs">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Camera className="h-5 w-5 text-emerald-600" />
                        <CardTitle>Reconnaissance Visuelle des Produits (TPV / POS)</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-600 bg-emerald-500/10">
                        100% Local & Hors-Ligne (Sans IA externe)
                    </Badge>
                </div>
                <CardDescription>
                    Moteur de vision par descripteurs spatiaux couleur et contours (Sobel/YCbCr). Permet d&apos;identifier un produit en caisse instantanément (&lt;50ms) en prenant simplement une photo sous un angle similaire, sans aucun coût d&apos;API externe.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/40 p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold">Articles indexés dans le moteur visuel</p>
                        <p className="text-xs text-muted-foreground">
                            {cachedCount !== null 
                                ? `${cachedCount} article(s) avec signature visuelle active en base locale.` 
                                : "Calcul de l'index en cours..."}
                        </p>
                    </div>
                    <Button
                        type="button"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-1.5"
                    >
                        {isSyncing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Synchronisation...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                Réindexer tout le catalogue
                            </>
                        )}
                    </Button>
                </div>
                <div className="text-[12px] text-muted-foreground space-y-1">
                    <p>• <strong>Enregistrement :</strong> Lors de la création d&apos;un article, prenez une photo avec la caméra ou importez une image.</p>
                    <p>• <strong>En caisse (POS) :</strong> Cliquez sur &quot;Reconnaissance Visuelle&quot;, cadrez le produit et la caisse le sélectionne immédiatement.</p>
                </div>
            </CardContent>
        </Card>
    )
}

import { getAdminUsers, createAdminUser, deleteAdminUser } from "@/app/actions/users"
import { Trash2, ShieldAlert, Plus, RefreshCw, Download, Upload, AlertOctagon } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function DataManagement() {
    const [loadingAction, setLoadingAction] = useState(false)

    // Export logic
    const handleExport = async () => {
        setLoadingAction(true)
        try {
            toast.loading("Génération de la sauvegarde...", { id: "backup" })
            const res = await fetch("/api/backup")
            if (!res.ok) throw new Error("Erreur de sauvegarde")
            const data = await res.json()
            
            // Download as file
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `backup_ish_erp_${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            
            toast.success("Sauvegarde téléchargée avec succès", { id: "backup" })
        } catch (e: any) {
            toast.error(e.message || "Erreur lors de l'exportation", { id: "backup" })
        }
        setLoadingAction(false)
    }

    // Import logic
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        
        if (!confirm("ATTENTION : Cette action va ÉCRASER toutes les données actuelles. Confirmez-vous ?")) {
            e.target.value = ""
            return
        }

        setLoadingAction(true)
        toast.loading("Restauration en cours... Veuillez patienter", { id: "restore" })

        try {
            const reader = new FileReader()
            reader.onload = async (event) => {
                try {
                    const json = JSON.parse(event.target?.result as string)
                    
                    const res = await fetch("/api/backup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(json)
                    })

                    if (!res.ok) throw new Error("Erreur serveur lors de la restauration")
                    toast.success("Données restaurées. Veuillez rafraîchir la page.", { id: "restore" })
                    setTimeout(() => window.location.reload(), 2000)
                } catch (err: any) {
                    toast.error(err.message || "Fichier invalide", { id: "restore" })
                }
            }
            reader.readAsText(file)
        } catch (error) {
            toast.error("Erreur lors de la lecture du fichier", { id: "restore" })
        }
        setLoadingAction(false)
    }

    // Reset logic
    const handleReset = async (mode: 'transactions' | 'full') => {
        const confirmationWord = mode === 'full' ? 'PURGER TOUT' : 'PURGER'
        const input = prompt(`ATTENTION DANGER EXTRÊME :\n\nTapez "${confirmationWord}" pour confirmer la suppression définitive.`);
        
        if (input !== confirmationWord) {
            toast.info("Opération annulée.")
            return
        }

        setLoadingAction(true)
        toast.loading("Suppression des données...", { id: "reset" })
        
        try {
            const supabase = createClient()
            const { error } = await (supabase.rpc as any)("rpc_reset_database", { p_mode: mode })
            
            if (error) throw error
            
            toast.success("Système réinitialisé avec succès.", { id: "reset" })
            setTimeout(() => window.location.reload(), 2000)
        } catch (e: any) {
            toast.error("Échec de la réinitialisation", { id: "reset" })
            console.error(e)
        }
        setLoadingAction(false)
    }

    return (
        <Card className="border-red-500/30">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <AlertOctagon className="h-6 w-6 text-red-600" />
                    <CardTitle className="text-red-600">Zone de Danger & Sauvegarde</CardTitle>
                </div>
                <CardDescription>
                    Effectuez des copies de sécurité complètes ou purgez le système. Manipuler avec une extrême précaution.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-2">
                        <Label className="text-base font-semibold">Sauvegarder les données</Label>
                        <p className="text-sm text-muted-foreground mb-4">
                            Téléchargez un fichier JSON contenant l'intégralité de la base de données.
                        </p>
                        <Button 
                            className="w-full flex gap-2" 
                            onClick={handleExport} 
                            disabled={loadingAction}
                        >
                            <Download className="h-4 w-4" /> Exporter le système (JSON)
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-base font-semibold">Restaurer les données</Label>
                        <p className="text-sm text-muted-foreground mb-4">
                            Importez un fichier de sauvegarde. Remplace définitivement les données actuelles.
                        </p>
                        <div className="relative">
                            <Input 
                                type="file" 
                                accept=".json"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                                onChange={handleImport}
                                disabled={loadingAction}
                            />
                            <Button 
                                variant="outline" 
                                className="w-full flex gap-2 pointer-events-none"
                            >
                                <Upload className="h-4 w-4" /> Importer une sauvegarde
                            </Button>
                        </div>
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                    <Label className="text-base font-semibold text-red-600">Purge du système</Label>
                    
                    <div className="flex flex-col gap-4 items-start">
                        <div className="flex items-center justify-between w-full border border-red-200 p-4 rounded-lg">
                            <div>
                                <h4 className="font-semibold text-sm">Opérationnelle (Reset Partiel)</h4>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    Supprime uniquement l'historique (Factures, BL, Devis, Paiements, etc.) et remet le stock à zéro. Vos clients, articles et employés sont <strong>conservés</strong>.
                                </p>
                            </div>
                            <Button variant="destructive" disabled={loadingAction} onClick={() => handleReset('transactions')}>
                                Purgation Partielle
                            </Button>
                        </div>

                        <div className="flex items-center justify-between w-full border border-red-500/50 bg-red-50/50 dark:bg-red-950/20 p-4 rounded-lg">
                            <div>
                                <h4 className="font-semibold text-sm text-red-600">Totale & Définitive (Reset Total)</h4>
                                <p className="text-sm text-red-600/80 max-w-md">
                                    Supprime <strong>tout</strong>. Factures, Clients, Articles, Fournisseurs. Remet l'application à l'état vierge usine. Seuls les comptes utilisateurs restent existants.
                                </p>
                            </div>
                            <Button variant="destructive" disabled={loadingAction} onClick={() => handleReset('full')}>
                                Purgation Totale
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function AdminManagement({ profileEmail }: { profileEmail: string }) {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingAction, setLoadingAction] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)

    const fetchUsers = async () => {
        setLoading(true)
        const res = await getAdminUsers()
        if (Array.isArray(res)) setUsers(res)
        setLoading(false)
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoadingAction(true)
        const formData = new FormData(e.currentTarget)
        const res = await createAdminUser(formData)
        
        if (res.error) toast.error(res.error)
        else {
            toast.success("Administrateur créé avec succès")
            setDialogOpen(false)
            fetchUsers()
        }
        setLoadingAction(false)
    }

    const handleDelete = async (id: string, email: string) => {
        if (email === profileEmail) {
            toast.error("Opération non permise: vous ne pouvez pas supprimer votre propre compte.")
            return
        }
        if (!confirm(`Tuer l'accès admin pour ${email} ?`)) return
        
        setLoadingAction(true)
        const res = await deleteAdminUser(id)
        if (res.error) toast.error(res.error)
        else {
            toast.success("Administrateur supprimé")
            fetchUsers()
        }
        setLoadingAction(false)
    }

    return (
        <Card className="border-orange-500/20">
            <CardHeader className="flex flex-row space-y-0 justify-between items-center">
                <div>
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-orange-500" />
                        <CardTitle className="text-orange-500">Gestion des Administrateurs</CardTitle>
                    </div>
                    <CardDescription>Créez ou gérez les accès avec un pouvoir total sur le système</CardDescription>
                </div>
                
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="default" className="bg-orange-600 hover:bg-orange-700">
                            <Plus className="mr-2 h-4 w-4" /> Nouvel Admin
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Ajouter un nouvel Administrateur</DialogTitle>
                            <DialogDescription>Générez un nouvel identifiant sécurisé pour un gestionnaire principal.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><Label>Nom</Label><Input name="nom" required /></div>
                                <div><Label>Prénom</Label><Input name="prenom" required /></div>
                            </div>
                            <div><Label>Email</Label><Input name="email" type="email" required /></div>
                            <div><Label>Mot de passe</Label><Input name="password" type="password" required minLength={6} /></div>
                            <DialogFooter>
                                <Button type="submit" disabled={loadingAction}>
                                    {loadingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Créer le compte
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-4"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom complet</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((u) => (
                                <TableRow key={u.id}>
                                    <TableCell className="font-medium">{u.nom} {u.prenom}</TableCell>
                                    <TableCell>{u.email}</TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => handleDelete(u.id, u.email)}
                                            disabled={loadingAction || u.email === profileEmail}
                                            className={u.email === profileEmail ? "opacity-30" : "text-red-500 hover:text-red-700 hover:bg-red-100"}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {users.length === 0 && (
                                <TableRow><TableCell colSpan={3} className="text-center">Aucun autre administrateur trouvé.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}

