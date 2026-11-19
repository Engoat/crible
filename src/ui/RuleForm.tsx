import { useState } from 'react';
import type { ColumnInfo } from '../engine/types';
import { isNumeric } from '../engine/types';
import { OPERATEURS } from '../engine/rules/describe';
import { ruleTypeInfo } from '../engine/rules/model';
import type { FormatId, Gravite, Operateur, Rule } from '../engine/rules/model';

interface Props {
  initial: Rule;
  columns: ColumnInfo[];
  onSave(rule: Rule): void;
  onCancel(): void;
}

const FORMATS: { id: FormatId; label: string }[] = [
  { id: 'email', label: 'Adresse e-mail' },
  { id: 'telephone', label: 'Numéro de téléphone' },
  { id: 'code_postal_fr', label: 'Code postal français (5 chiffres)' },
  { id: 'nombre', label: 'Nombre' },
  { id: 'date', label: 'Date selon un format' },
  { id: 'motif', label: 'Motif personnalisé (expression régulière)' },
];

const DATE_FORMATS = ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y', '%Y-%m-%d %H:%M:%S', '%d/%m/%Y %H:%M'];

const toNumber = (text: string, fallback: number): number => {
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

export function RuleForm({ initial, columns, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Rule>(initial);
  const [pctTolerance, setPctTolerance] = useState(String(initial.tolerance * 100));
  const info = ruleTypeInfo(draft.type);
  const patch = (p: Record<string, unknown>) => setDraft((d) => ({ ...d, ...p }) as Rule);
  const colType = 'colonne' in draft ? columns.find((c) => c.name === draft.colonne)?.type : undefined;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ ...draft, tolerance: Math.min(1, Math.max(0, toNumber(pctTolerance, 0) / 100)) } as Rule);
  }

  const colonnePicker = (label: string, value: string, onChange: (v: string) => void) => (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— choisir —</option>
        {columns.map((c) => (
          <option key={c.name} value={c.name}>{c.name}</option>
        ))}
      </select>
    </label>
  );

  return (
    <form className="formulaire" onSubmit={submit}>
      <h4>{info.label}</h4>

      {draft.type === 'unique' && (
        <fieldset>
          <legend>Colonnes dont la combinaison doit être unique</legend>
          <div className="cases">
            {columns.map((c) => (
              <label key={c.name} className="case">
                <input
                  type="checkbox"
                  checked={draft.colonnes.includes(c.name)}
                  onChange={(e) =>
                    patch({
                      colonnes: e.target.checked
                        ? [...draft.colonnes, c.name]
                        : draft.colonnes.filter((n) => n !== c.name),
                    })
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {draft.type === 'plage' && (
        <div className="grille">
          <label>
            Minimum
            <input value={draft.min ?? ''} onChange={(e) => patch({ min: e.target.value })} placeholder={isNumeric(colType ?? { kind: 'text' }) ? 'ex. 0' : 'ex. 2020-01-01'} />
          </label>
          <label className="case">
            <input type="checkbox" checked={draft.minExclu} onChange={(e) => patch({ minExclu: e.target.checked })} />
            minimum exclu
          </label>
          <label>
            Maximum
            <input value={draft.max ?? ''} onChange={(e) => patch({ max: e.target.value })} placeholder={isNumeric(colType ?? { kind: 'text' }) ? 'ex. 120' : 'ex. 2030-12-31'} />
          </label>
          <label className="case">
            <input type="checkbox" checked={draft.maxExclu} onChange={(e) => patch({ maxExclu: e.target.checked })} />
            maximum exclu
          </label>
        </div>
      )}

      {draft.type === 'format' && (
        <div className="grille">
          <label>
            Format attendu
            <select value={draft.format} onChange={(e) => patch({ format: e.target.value })}>
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </label>
          {draft.format === 'date' && (
            <label>
              Format de date
              <select value={draft.formatDate} onChange={(e) => patch({ formatDate: e.target.value })}>
                {DATE_FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>
          )}
          {draft.format === 'motif' && (
            <label>
              Motif
              <input value={draft.motif} onChange={(e) => patch({ motif: e.target.value })} placeholder="ex. [A-Z]{2}[0-9]{4}" />
            </label>
          )}
        </div>
      )}

      {draft.type === 'valeurs_autorisees' && (
        <div className="grille">
          <label>
            Valeurs autorisées (une par ligne)
            <textarea
              rows={5}
              value={draft.valeurs.join('\n')}
              onChange={(e) => patch({ valeurs: e.target.value.split('\n') })}
            />
          </label>
          <label className="case">
            <input type="checkbox" checked={draft.casse} onChange={(e) => patch({ casse: e.target.checked })} />
            respecter la casse
          </label>
        </div>
      )}

      {draft.type === 'entre_colonnes' && (
        <div className="grille">
          {colonnePicker('Colonne', draft.colonneA, (v) => patch({ colonneA: v }))}
          <label>
            Condition
            <select value={draft.operateur} onChange={(e) => patch({ operateur: e.target.value as Operateur })}>
              {OPERATEURS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          {colonnePicker('Autre colonne', draft.colonneB, (v) => patch({ colonneB: v }))}
        </div>
      )}

      {draft.type === 'aberrantes' && (
        <label>
          Facteur de Tukey (1,5 : aberrante, 3 : très aberrante)
          <input value={String(draft.facteur)} onChange={(e) => patch({ facteur: toNumber(e.target.value, 1.5) })} />
        </label>
      )}

      {draft.type === 'non_constante' && (
        <div className="grille">
          <label>
            Nombre minimal de valeurs distinctes
            <input value={String(draft.minDistincts)} onChange={(e) => patch({ minDistincts: toNumber(e.target.value, 2) })} />
          </label>
          <label>
            Part maximale de la valeur dominante (%)
            <input value={String(draft.partMax * 100)} onChange={(e) => patch({ partMax: toNumber(e.target.value, 99) / 100 })} />
          </label>
        </div>
      )}

      {draft.type === 'distribution' && (
        <div className="grille">
          {colType && isNumeric(colType) ? (
            <label>
              Asymétrie maximale (en valeur absolue)
              <input value={String(draft.asymetrieMax)} onChange={(e) => patch({ asymetrieMax: toNumber(e.target.value, 1) })} />
            </label>
          ) : (
            <label>
              Part maximale de la modalité dominante (%)
              <input value={String(draft.partMax * 100)} onChange={(e) => patch({ partMax: toNumber(e.target.value, 95) / 100 })} />
            </label>
          )}
        </div>
      )}

      {draft.type === 'texte_propre' && (
        <div className="cases">
          <label className="case">
            <input type="checkbox" checked={draft.espaces} onChange={(e) => patch({ espaces: e.target.checked })} />
            pas d'espace en début ou en fin de valeur
          </label>
          <label className="case">
            <input type="checkbox" checked={draft.casse} onChange={(e) => patch({ casse: e.target.checked })} />
            une seule façon d'écrire chaque valeur (casse)
          </label>
        </div>
      )}

      {!info.global && (
        <label>
          Tolérance : part de lignes en défaut acceptée (%)
          <input value={pctTolerance} onChange={(e) => setPctTolerance(e.target.value)} />
        </label>
      )}

      <label>
        Gravité
        <select value={draft.gravite} onChange={(e) => patch({ gravite: e.target.value as Gravite })}>
          <option value="bloquante">Bloquante</option>
          <option value="avertissement">Avertissement</option>
        </select>
      </label>

      <div className="boutons">
        <button type="submit" className="primaire">Enregistrer la règle</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
