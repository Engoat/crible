import { useEffect, useRef, useState } from 'react';
import type { MlRoles } from '../engine/ml/model';
import type { Rule } from '../engine/rules/model';
import { deleteRuleSet, listRuleSets, saveRuleSet } from '../rules-store/storage';
import { downloadRuleSet, makeRuleSet, parseRuleSet } from '../rules-store/ruleset';
import type { RuleSet } from '../rules-store/ruleset';

interface Props {
  nom: string;
  rules: Rule[];
  roles: MlRoles;
  onNom(nom: string): void;
  onLoad(set: RuleSet): void;
  onNew(): void;
}

export function EnsemblesBar({ nom, rules, roles, onNom, onLoad, onNew }: Props) {
  const [sets, setSets] = useState<RuleSet[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => listRuleSets().then(setSets).catch(() => setSets([]));
  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    const name = nom.trim();
    if (!name) return setMessage('Donne un nom à l\'ensemble.');
    await saveRuleSet(makeRuleSet(name, rules, roles));
    setMessage(`« ${name} » enregistré dans ce navigateur.`);
    refresh();
  }

  async function remove(name: string) {
    await deleteRuleSet(name);
    setMessage(`« ${name} » supprimé.`);
    refresh();
  }

  async function importFile(file: File) {
    try {
      const set = parseRuleSet(await file.text());
      onLoad(set);
      setMessage(`« ${set.nom} » importé.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="ensembles" aria-label="Ensembles de règles">
      <label className="champ en-ligne">
        Ensemble de règles
        <input value={nom} onChange={(e) => onNom(e.target.value)} aria-label="Nom de l'ensemble" />
      </label>
      <button type="button" className="primaire" onClick={save}>Enregistrer</button>
      <button type="button" onClick={() => downloadRuleSet(makeRuleSet(nom.trim() || 'regles', rules, roles))}>Exporter</button>
      <button type="button" onClick={() => fileInput.current?.click()}>Importer</button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importFile(f);
          e.target.value = '';
        }}
      />
      <button type="button" onClick={onNew}>Nouvel ensemble</button>
      {sets.length > 0 && (
        <label className="champ en-ligne">
          Ouvrir
          <select
            value=""
            onChange={(e) => {
              const found = sets.find((s) => s.nom === e.target.value);
              if (found) {
                onLoad(found);
                setMessage(`« ${found.nom} » ouvert.`);
              }
            }}
          >
            <option value="">— mes ensembles —</option>
            {sets.map((s) => (
              <option key={s.nom} value={s.nom}>{s.nom} ({s.regles.length})</option>
            ))}
          </select>
        </label>
      )}
      {sets.some((s) => s.nom === nom.trim()) && (
        <button type="button" onClick={() => remove(nom.trim())}>Supprimer « {nom.trim()} »</button>
      )}
      {message && <span className="doux" role="status">{message}</span>}
    </section>
  );
}
