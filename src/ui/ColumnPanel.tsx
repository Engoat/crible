import { useEffect, useState } from 'react';
import { examples } from '../engine/load';
import { absentColumns } from '../engine/rules/run';
import { RULE_TYPES, newRule, refColumns } from '../engine/rules/model';
import type { Rule, RuleResult } from '../engine/rules/model';
import { TYPE_OPTIONS, typeId } from '../engine/types';
import type { ColumnInfo, Dataset } from '../engine/types';
import { nombre } from './format';
import { RuleForm } from './RuleForm';
import { RuleRow } from './RuleRow';

interface Props {
  dataset: Dataset;
  column: ColumnInfo;
  rules: Rule[];
  results: Record<string, RuleResult>;
  calcul: boolean;
  onType(name: string, id: string): void;
  onSaveRule(rule: Rule): void;
  onToggle(id: string): void;
  onRemove(id: string): void;
  onRows(rule: Rule): void;
  onHelp(id: string): void;
}

export function ColumnPanel({ dataset, column, rules, results, calcul, onType, onSaveRule, onToggle, onRemove, onRows, onHelp }: Props) {
  const [exemples, setExemples] = useState<string[]>([]);
  const [form, setForm] = useState<Rule | null>(null);

  useEffect(() => {
    let actif = true;
    setForm(null);
    examples(column.name).then((e) => actif && setExemples(e));
    return () => {
      actif = false;
    };
  }, [column.name, dataset.fileName]);

  const siennes = rules.filter((r) => refColumns(r).includes(column.name));
  const types = RULE_TYPES.filter((t) => t.portee !== 'jeu' && t.applicable(column.type));

  return (
    <section className="fiche" aria-label={`Colonne ${column.name}`}>
      <h2>{column.name}</h2>
      <p className="soustitre">{nombre(dataset.rows)} lignes</p>

      <label className="champ">
        Type
        <select value={typeId(column.type)} onChange={(e) => onType(column.name, e.target.value)}>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </label>

      <h3>Exemples de valeurs</h3>
      {exemples.length === 0 ? (
        <p className="doux">Aucune valeur renseignée.</p>
      ) : (
        <ul className="exemples">
          {exemples.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <h3>Règles de cette colonne</h3>
      {siennes.length === 0 && <p className="doux">Aucune règle pour l'instant.</p>}
      <ul className="regles">
        {siennes.map((r) => (
          <RuleRow
            key={r.id}
            rule={r}
            result={results[r.id]}
            absentes={absentColumns(r, dataset.columns)}
            calcul={calcul}
            onEdit={() => setForm(r)}
            onRows={() => onRows(r)}
            onHelp={() => onHelp(r.type)}
            onToggle={() => onToggle(r.id)}
            onRemove={() => onRemove(r.id)}
          />
        ))}
      </ul>

      {form ? (
        <RuleForm
          key={form.id}
          initial={form}
          columns={dataset.columns}
          onSave={(r) => {
            onSaveRule(r);
            setForm(null);
          }}
          onCancel={() => setForm(null)}
        />
      ) : (
        <label className="champ">
          Ajouter une règle
          <select
            value=""
            onChange={(e) => {
              const t = RULE_TYPES.find((x) => x.type === e.target.value);
              if (t) setForm(newRule(t.type, column.name));
            }}
          >
            <option value="">— choisir un type de règle —</option>
            {types.map((t) => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
