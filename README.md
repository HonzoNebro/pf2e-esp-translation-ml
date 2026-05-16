<div align="center">
<h3 align="center">PF2E Spanish Translation ML</h3>
</div>

## Proyecto

`pf2e-esp-translation-ml` es un modulo no oficial para Foundry VTT que busca mantener una traduccion al español de Pathfinder Segunda Edicion apoyada por IA y revision humana.

El proyecto parte de una base tecnica y de traducciones existente en `pf2e-esp-translation`, pero se publica como repositorio y paquete independiente. El identificador del modulo es `pf2e-esp-translation-ml`.

## Criterio de traduccion

La prioridad terminologica del proyecto es:

1. Manuales oficiales en español usados localmente como fuente de glosario.
2. Traducciones ya existentes cuando no contradigan los manuales.
3. Propuestas generadas con IA, siempre marcables para revision si hay conflicto o baja confianza.

Los PDFs oficiales no forman parte del repositorio. Se usan solo como material local de referencia para construir un glosario y evitar redistribuir texto protegido.

## Compatibilidad

- Foundry VTT: 14.360 o superior dentro de la generacion 14.
- Pathfinder 2E System: 8.1.2 dentro de la generacion 8.
- Requiere Babele y libWrapper.

## Desarrollo

Para instalar dependencias:

```bash
npm install
```

Para regenerar fuentes inglesas desde la version configurada de PF2e:

```bash
npm run pack-extractor
```

Para generar el glosario base desde PDFs oficiales locales:

```bash
npm run glossary:manual
```

El comando espera pares de PDFs locales con el patron `pdfs/*-eng.pdf` y `pdfs/*-spa.pdf`, extrae texto intermedio en `sources/extracted/` y actualiza `glossary/manual-glossary.json`. Tanto `pdfs/` como `sources/` estan ignoradas por Git.

Para auditar el impacto del glosario sobre traducciones existentes:

```bash
npm run glossary:audit
```

Por defecto revisa las acciones traducidas y escribe el informe local en `sources/reports/glossary-impact.json`. Tambien puedes pasar archivos concretos como argumentos tras `--`.

Para auditar todo el compendio traducido:

```bash
npm run glossary:audit -- translation/es/compendium
```

El glosario es una guia terminologica, no una tabla de sustitucion automatica. Los terminos aprobados sirven para decidir que palabra usar cuando el contexto coincide, pero las frases completas deben traducirse de forma natural.

Existe un comando heredado para estimar reemplazos automaticos, pero no debe usarse para escribir cambios en traducciones reales:

```bash
npm run glossary:apply -- translation/es/compendium
```

El modo `--write` esta bloqueado deliberadamente porque produce traducciones hibridas en nombres y expresiones compuestas.

Para reparar textos que ya quedaron hibridos por antiguas sustituciones automaticas del glosario:

```bash
npm run glossary:repair-hybrids -- translation/es
```

Sin `--write`, genera un informe en `sources/reports/glossary-hybrid-repair.json`. Con `--write`, solo restaura terminos del glosario a ingles en cadenas que siguen siendo mayoritariamente inglesas o que coinciden exactamente con la fuente inglesa tras deshacer esas sustituciones.

Los commits deberian seguir [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## Licencia y atribucion

Este proyecto se distribuye bajo la licencia ORC incluida en `LICENSE`. Consulta `NOTICE.md` para atribuciones y cautelas de uso.

Este proyecto no esta afiliado, patrocinado ni aprobado por Paizo, Foundry Gaming LLC ni por el equipo de PF2e para Foundry VTT.
