const SKILL_SELECTION_MIGRATIONS = new Map([
  ["diagnose", "diagnosing-bugs"],
  ["to-prd", "to-spec"],
  ["write-a-skill", "writing-for-agents"],
  ["to-issues", null],
  ["caveman", null],
  ["zoom-out", null],
]);

export function migrateSelection(selection) {
  return {
    ...selection,
    skills: migrateNames(selection.skills ?? [], SKILL_SELECTION_MIGRATIONS),
  };
}

function migrateNames(names, migrations) {
  const migrated = names.flatMap((name) => {
    const successor = migrations.has(name) ? migrations.get(name) : name;
    return successor === null ? [] : [successor];
  });
  return [...new Set(migrated)];
}
