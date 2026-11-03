import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import {
  NUTRITION_TARGET_FIELDS,
  nutritionTargetDraft,
  parseNutritionTargets,
  updateProfile,
  type NutritionTargetKey,
} from "@forja/app-core/data/profile";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Metas nutricionais **manuais** e opcionais.
 *
 * O app não calcula nem sugere metas: quem tem acompanhamento digita as que o
 * nutricionista definiu. Campo vazio = sem meta, e as telas mostram só o
 * consumido. Os limites são os mesmos do banco.
 */
const CAMPOS = NUTRITION_TARGET_FIELDS;
type Chave = NutritionTargetKey;
type Perfil = { id: string } & Partial<Record<Chave, number | string | null>>;

export function ManualNutritionTargets({ profile }: { profile: Perfil }) {
  const qc = useQueryClient();
  const inicial = () => nutritionTargetDraft(profile);
  const [valores, setValores] = useState<Record<Chave, string>>(inicial);
  const [erros, setErros] = useState<Partial<Record<Chave, string>>>({});

  const salvar = useMutation({
    mutationFn: (patch: Record<Chave, number | null>) =>
      updateProfile(profile.id, patch, "salvar metas nutricionais"),
    onSuccess: (_, patch) => {
      toast.success(
        Object.values(patch).every((v) => v === null) ? "Metas removidas" : "Metas salvas",
      );
      void qc.invalidateQueries({ queryKey: queryKeys.profile() });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseNutritionTargets(valores);
    setErros(r.ok ? {} : r.erros);
    if (r.ok) salvar.mutate(r.patch);
  };

  const algumaMeta = CAMPOS.some((c) => profile[c.key] != null);

  return (
    <form onSubmit={enviar} className="rounded-[1.25rem] bg-card p-4" noValidate>
      <p className="text-pretty text-sm text-muted-foreground">
        Opcional. Se você tem acompanhamento, preencha com as metas definidas pelo seu
        nutricionista. Deixe em branco para não usar metas — as telas mostram só o que você
        consumiu.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {CAMPOS.map((c) => (
          <div key={c.key} className={c.key === "daily_kcal_target" ? "col-span-2" : undefined}>
            <Label htmlFor={c.key}>
              {c.rotulo}{" "}
              <span className="font-normal text-muted-foreground">({c.unidade}/dia)</span>
            </Label>
            <Input
              id={c.key}
              type="number"
              inputMode="numeric"
              min={c.min}
              max={c.max}
              placeholder="Sem meta"
              value={valores[c.key]}
              onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
              aria-invalid={!!erros[c.key]}
              aria-describedby={erros[c.key] ? `${c.key}-erro` : undefined}
              className="mt-1.5 h-12 rounded-xl text-base tabular-nums"
            />
            {erros[c.key] && (
              <p id={`${c.key}-erro`} role="alert" className="mt-1 text-xs text-destructive">
                {erros[c.key]}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="h-12 flex-1 rounded-xl" disabled={salvar.isPending}>
          {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Salvar metas
        </Button>
        {algumaMeta && (
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl"
            disabled={salvar.isPending}
            onClick={() => {
              setValores(
                Object.fromEntries(CAMPOS.map((c) => [c.key, ""])) as Record<Chave, string>,
              );
              setErros({});
              salvar.mutate(
                Object.fromEntries(CAMPOS.map((c) => [c.key, null])) as Record<Chave, null>,
              );
            }}
          >
            Remover metas
          </Button>
        )}
      </div>
    </form>
  );
}
