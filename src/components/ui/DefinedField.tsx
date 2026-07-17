import { FieldTooltip } from "./FieldTooltip";
import { fieldDefinitions, type FieldDefinitionKey } from "@/lib/fieldDefinitions";

interface Props {
  definitionKey: FieldDefinitionKey;
  required?: boolean;
  htmlFor?: string;
}

/** تسمية حقل مع توضيح مأخوذ من القاموس المركزي `fieldDefinitions`. */
export function DefinedField({ definitionKey, required, htmlFor }: Props) {
  const def = fieldDefinitions[definitionKey];
  const example = "example" in def ? def.example : undefined;

  return (
    <FieldTooltip
      label={def.label}
      required={required}
      tooltip={def.tooltip}
      example={example}
      htmlFor={htmlFor}
    />
  );
}
