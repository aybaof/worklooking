import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MapPin, Globe, Plus, Trash2 } from "lucide-react";
import { Field } from "./shared";
import { Resume } from "@/lib/resume-types";

interface BasicsSectionProps {
  basics: Resume["basics"];
  onUpdate: (field: string, value: any) => void;
  onUpdateLocation: (field: string, value: any) => void;
  onUpdateProfile: (index: number, field: string, value: any) => void;
  onAddProfile: () => void;
  onRemoveProfile: (index: number) => void;
}

export function BasicsSection({ basics, onUpdate, onUpdateLocation, onUpdateProfile, onAddProfile, onRemoveProfile }: BasicsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations de base</CardTitle>
        <CardDescription>Vos coordonnées et informations personnelles.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom complet" value={basics?.name} onChange={v => onUpdate("name", v)} />
          <Field label="Titre / Label" value={basics?.label} onChange={v => onUpdate("label", v)} placeholder="ex: Développeur Fullstack" />
        </div>
        <Field label="URL Photo / Image" value={basics?.image} onChange={v => onUpdate("image", v)} placeholder="https://..." />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" value={basics?.email} onChange={v => onUpdate("email", v)} />
          <Field label="Téléphone" value={basics?.phone} onChange={v => onUpdate("phone", v)} />
        </div>
        <Field label="Site Web / URL" value={basics?.url} onChange={v => onUpdate("url", v)} />
        <div className="space-y-2">
          <label className="text-sm font-medium">Résumé</label>
          <Textarea value={basics?.summary} onChange={e => onUpdate("summary", e.target.value)} rows={4} />
        </div>
        <div className="pt-4 border-t">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Localisation
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Ville" value={basics?.location?.city} onChange={v => onUpdateLocation("city", v)} />
            <Field label="Région" value={basics?.location?.region} onChange={v => onUpdateLocation("region", v)} />
            <Field label="Code Pays" value={basics?.location?.countryCode} onChange={v => onUpdateLocation("countryCode", v)} />
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4" /> Profils Sociaux
            </h3>
            <Button size="sm" variant="ghost" onClick={onAddProfile}>
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </div>
          <div className="space-y-3">
            {basics?.profiles?.map((profile, i) => (
              <div key={i} className="flex items-end gap-3 p-3 bg-muted/30 rounded-lg relative group">
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <Field label="Réseau" value={profile.network} onChange={v => onUpdateProfile(i, "network", v)} placeholder="ex: LinkedIn" />
                  <Field label="Nom d'utilisateur" value={profile.username} onChange={v => onUpdateProfile(i, "username", v)} />
                  <Field label="URL" value={profile.url} onChange={v => onUpdateProfile(i, "url", v)} />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-destructive h-9" 
                  onClick={() => onRemoveProfile(i)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
