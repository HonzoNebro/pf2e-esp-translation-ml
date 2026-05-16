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

Los commits deberian seguir [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## Licencia y atribucion

Este proyecto se distribuye bajo la licencia ORC incluida en `LICENSE`. Consulta `NOTICE.md` para atribuciones y cautelas de uso.

Este proyecto no esta afiliado, patrocinado ni aprobado por Paizo, Foundry Gaming LLC ni por el equipo de PF2e para Foundry VTT.
