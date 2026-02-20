---
name: creador-de-habilidades
description: Guía para crear habilidades efectivas. Usa esta habilidad cuando el usuario quiera crear una nueva habilidad (o actualizar una existente) que extienda las capacidades de Claude con conocimiento especializado, flujos de trabajo o integraciones de herramientas.
license: Términos completos en LICENSE.txt
---

# Creador de habilidades

Esta habilidad proporciona guía para crear habilidades efectivas.

## Sobre las habilidades

Las habilidades son paquetes modulares y autónomos que extienden las capacidades de Claude proporcionando conocimiento especializado, flujos de trabajo y herramientas. Piensa en ellas como "guías de integración" para dominios específicos o tareas; transforman a Claude de un agente de propósito general a un agente especializado equipado con conocimiento de procedimiento que ningún modelo puede poseer completamente.

### Qué proporcionan las habilidades

1.  Flujos de trabajo especializados: procedimientos de múltiples pasos para dominios específicos.
2.  Integraciones de herramientas: instrucciones para trabajar con formatos de archivo específicos o API.
3.  Experiencia de dominio: conocimiento específico de empresa, esquemas, lógica de negocio.
4.  Recursos agrupados: scripts, referencias y activos para tareas complejas y repetitivas.

## Principios fundamentales

### La concisión es clave

La ventana de contexto es un bien público. Las habilidades comparten la ventana de contexto con todo lo demás que Claude necesita: prompt del sistema, historial de conversación, metadatos de otras habilidades y la solicitud real del usuario.

**Suposición predeterminada: Claude ya es muy inteligente.** Solo agrega contexto que Claude no tenga ya. Cuestiona cada pieza de información: "¿Realmente necesita Claude esta explicación?" y "¿Este párrafo justifica su costo en tokens?"

Prefiere ejemplos concisos sobre explicaciones verbosas.

### Establecer grados de libertad apropiados

Coincide el nivel de especificidad con la fragilidad y variabilidad de la tarea:

**Alta libertad (instrucciones basadas en texto)**: usar cuando múltiples enfoques son válidos, las decisiones dependen del contexto o la heurística guía el enfoque.

**Libertad media (pseudocódigo o scripts con parámetros)**: usar cuando existe un patrón preferido, alguna variación es aceptable o la configuración afecta el comportamiento.

**Baja libertad (scripts específicos, pocos parámetros)**: usar cuando las operaciones son frágiles y propensas a errores, la consistencia es crítica o se debe seguir una secuencia específica.

Piensa en Claude como explorando un camino: un puente estrecho con acantilados necesita barandillas específicas (baja libertad), mientras que un campo abierto permite muchas rutas (alta libertad).

### Anatomía de una habilidad

Cada habilidad consiste en un archivo `SKILL.md` obligatorio y recursos agrupados opcionales:

```
nombre-habilidad/
├── SKILL.md (obligatorio)
│   ├── Metadatos YAML frontmatter (obligatorio)
│   │   ├── name: (obligatorio)
│   │   └── description: (obligatorio)
│   └── Instrucciones Markdown (obligatorio)
└── Recursos agrupados (opcional)
    ├── scripts/          - Código ejecutable (Python/Bash/etc.)
    ├── references/       - Documentación destinada a ser cargada en contexto según sea necesario
    └── assets/           - Archivos usados en la salida (plantillas, íconos, fuentes, etc.)
```

#### SKILL.md (obligatorio)

Cada `SKILL.md` consiste en:

-   **Frontmatter** (YAML): contiene los campos `name` y `description`. Estos son los únicos campos que Claude lee para determinar cuándo se usa la habilidad, por lo que es muy importante ser claro y completo al describir qué es la habilidad y cuándo debe usarse.
-   **Cuerpo** (Markdown): instrucciones y guía para usar la habilidad. Solo se carga DESPUÉS de que la habilidad se dispara (si es que lo hace).

#### Recursos agrupados (opcional)

##### Scripts (`scripts/`)

Código ejecutable (Python/Bash/etc.) para tareas que requieren fiabilidad determinista o se reescriben repetidamente.

-   **Cuándo incluir**: cuando el mismo código se reescribe repetidamente o se necesita fiabilidad determinista.
-   **Ejemplo**: `scripts/rotate_pdf.py` para tareas de rotación de PDF.
-   **Beneficios**: eficiente en tokens, determinista, puede ejecutarse sin cargarse en contexto.
-   **Nota**: los scripts aún pueden necesitar ser leídos por Claude para parches o ajustes específicos del entorno.

##### Referencias (`references/`)

Documentación y material de referencia destinado a ser cargado según sea necesario en el contexto para informar el proceso y pensamiento de Claude.

-   **Cuándo incluir**: para documentación que Claude debe referenciar mientras trabaja.
-   **Ejemplos**: `references/finanzas.md` para esquemas financieros, `references/mnda.md` para plantilla NDA de la empresa, `references/politicas.md` para políticas de empresa, `references/docs_api.md` para especificaciones de API.
-   **Casos de uso**: esquemas de base de datos, documentación de API, conocimiento de dominio, políticas de empresa, guías de flujo de trabajo detalladas.
-   **Beneficios**: mantiene `SKILL.md` ligero, cargado solo cuando Claude determina que es necesario.
-   **Mejor práctica**: si los archivos son grandes (>10k palabras), incluye patrones de búsqueda grep en `SKILL.md`.
-   **Evitar duplicación**: la información debe vivir en `SKILL.md` o en archivos de referencias, no en ambos. Prefiere archivos de referencias para información detallada a menos que sea verdaderamente central para la habilidad; esto mantiene `SKILL.md` ligero mientras hace que la información sea descubrible sin acaparar la ventana de contexto. Mantén solo instrucciones de procedimiento esenciales y guía de flujo de trabajo en `SKILL.md`; mueve material de referencia detallado, esquemas y ejemplos a archivos de referencias.

##### Activos (`assets/`)

Archivos no destinados a ser cargados en contexto, sino más bien usados dentro de la salida que produce Claude.

-   **Cuándo incluir**: cuando la habilidad necesita archivos que se usarán en la salida final.
-   **Ejemplos**: `assets/logo.png` para activos de marca, `assets/diapositivas.pptx` para plantillas de PowerPoint, `assets/plantilla-frontend/` para boilerplate HTML/React, `assets/fuente.ttf` para tipografía.
-   **Casos de uso**: plantillas, imágenes, íconos, código boilerplate, fuentes, documentos de muestra que se copian o modifican.
-   **Beneficios**: separa recursos de salida de la documentación, permite a Claude usar archivos sin cargarlos en la ventana de contexto.

#### Qué no incluir en una habilidad

Una habilidad solo debe contener archivos esenciales que apoyen directamente su funcionalidad. NO crees documentación superflua o archivos auxiliares, incluyendo:

-   README.md
-   INSTALLATION_GUIDE.md
-   QUICK_REFERENCE.md
-   CHANGELOG.md
-   etc.

La habilidad solo debe contener la información necesaria para que un agente de IA haga el trabajo en cuestión. No debe contener contexto auxiliar sobre el proceso que llevó a su creación, configuración y procedimientos de prueba, documentación orientada al usuario, etc. Crear archivos de documentación adicionales solo agrega desorden y confusión.

### Principio de diseño de revelación progresiva

Las habilidades usan un sistema de carga de tres niveles para gestionar el contexto eficientemente:

1.  **Metadatos (nombre + descripción)** - Siempre en contexto (~100 palabras).
2.  **Cuerpo SKILL.md** - Cuando la habilidad se dispara (<5k palabras).
3.  **Recursos agrupados** - Según sea necesario por Claude (Ilimitado porque los scripts pueden ejecutarse sin leerse en la ventana de contexto).

#### Patrones de revelación progresiva

Mantén el cuerpo de `SKILL.md` en lo esencial y por debajo de 500 líneas para minimizar la hinchazón del contexto. Divide el contenido en archivos separados cuando te acerques a este límite. Cuando dividas el contenido en otros archivos, es muy importante referenciarlos desde `SKILL.md` y describir claramente cuándo leerlos, para asegurar que el lector de la habilidad sepa que existen y cuándo usarlos.

**Principio clave:** cuando una habilidad soporta múltiples variaciones, marcos u opciones, mantén solo el flujo de trabajo central y la guía de selección en `SKILL.md`. Mueve detalles específicos de la variante (patrones, ejemplos, configuración) a archivos de referencia separados.

**Patrón 1: guía de alto nivel con referencias**

```markdown
# Procesamiento de PDF

## Inicio rápido

Extraer texto con pdfplumber:
[ejemplo de código]

## Funcionalidades avanzadas

- **Llenado de formularios**: ver [FORMULARIOS.md](FORMULARIOS.md) para guía completa.
- **Referencia de API**: ver [REFERENCIA.md](REFERENCIA.md) para todos los métodos.
- **Ejemplos**: ver [EJEMPLOS.md](EJEMPLOS.md) para patrones comunes.
```

Claude carga FORMULARIOS.md, REFERENCIA.md o EJEMPLOS.md solo cuando es necesario.

**Patrón 2: organización específica de dominio**

Para habilidades con múltiples dominios, organiza el contenido por dominio para evitar cargar contexto irrelevante:

```
habilidad-bigquery/
├── SKILL.md (visión general y navegación)
└── reference/
    ├── finanzas.md (ingresos, métricas de facturación)
    ├── ventas.md (oportunidades, pipeline)
    ├── producto.md (uso de API, características)
    └── marketing.md (campañas, atribución)
```

Cuando un usuario pregunta sobre métricas de ventas, Claude solo lee ventas.md.

**Patrón 3: detalles condicionales**

Muestra contenido básico, enlaza a contenido avanzado:

```markdown
# Procesamiento de DOCX

## Creación de documentos

Usa docx-js para documentos nuevos. Ver [DOCX-JS.md](DOCX-JS.md).

## Edición de documentos

Para ediciones simples, modifica el XML directamente.

**Para control de cambios**: ver [REDLINING.md](REDLINING.md).
**Para detalles de OOXML**: ver [OOXML.md](OOXML.md).
```

Claude lee REDLINING.md o OOXML.md solo cuando el usuario necesita esas características.

**Pautas importantes:**

-   **Evita referencias profundamente anidadas**: mantén referencias a un nivel de profundidad desde `SKILL.md`. Todos los archivos de referencia deben enlazarse directamente desde `SKILL.md`.
-   **Estructura archivos de referencia más largos**: para archivos de más de 100 líneas, incluye una tabla de contenidos al principio para que Claude pueda ver el alcance completo al previsualizar.

## Proceso de creación de habilidades

La creación de habilidades implica estos pasos:

1.  Entender la habilidad con ejemplos concretos.
2.  Planificar contenidos reutilizables de la habilidad (scripts, referencias, activos).
3.  Inicializar la habilidad (ejecutar init_skill.py).
4.  Editar la habilidad (implementar recursos y escribir SKILL.md).
5.  Empaquetar la habilidad (ejecutar package_skill.py).
6.  Iterar basado en uso real.

Sigue estos pasos en orden, saltando solo si hay una razón clara por la que no son aplicables.

### Paso 1: entender la habilidad con ejemplos concretos

Salta este paso solo cuando los patrones de uso de la habilidad ya se entiendan claramente. Sigue siendo valioso incluso cuando se trabaja con una habilidad existente.

Para crear una habilidad efectiva, entiende claramente ejemplos concretos de cómo se usará la habilidad. Este entendimiento puede provenir de ejemplos directos del usuario o ejemplos generados validados con retroalimentación del usuario.

Por ejemplo, al construir una habilidad de editor de imágenes, las preguntas relevantes incluyen:

-   "¿Qué funcionalidad debe soportar la habilidad de editor de imágenes? ¿Edición, rotación, algo más?"
-   "¿Puedes dar algunos ejemplos de cómo se usaría esta habilidad?"
-   "Puedo imaginar usuarios pidiendo cosas como 'Quita los ojos rojos de esta imagen' o 'Rota esta imagen'. ¿Hay otras formas en que imaginas que se use esta habilidad?"
-   "¿Qué diría un usuario que debería disparar esta habilidad?"

Para evitar abrumar a los usuarios, evita hacer demasiadas preguntas en un solo mensaje. Comienza con las preguntas más importantes y sigue según sea necesario para mayor efectividad.

Concluye este paso cuando haya un sentido claro de la funcionalidad que la habilidad debe soportar.

### Paso 2: planificar los contenidos reutilizables de la habilidad

Para convertir ejemplos concretos en una habilidad efectiva, analiza cada ejemplo:

1.  Considerando cómo ejecutar el ejemplo desde cero.
2.  Identificando qué scripts, referencias y activos serían útiles al ejecutar estos flujos de trabajo repetidamente.

Ejemplo: al construir una habilidad `editor-pdf` para manejar consultas como "Ayúdame a rotar este PDF", el análisis muestra:

1.  Rotar un PDF requiere reescribir el mismo código cada vez.
2.  Un script `scripts/rotate_pdf.py` sería útil para almacenar en la habilidad.

Ejemplo: al diseñar una habilidad `constructor-webapp-frontend` para consultas como "Constrúyeme una app de tareas" o "Constrúyeme un dashboard para rastrear mis pasos", el análisis muestra:

1.  Escribir una webapp frontend requiere el mismo boilerplate HTML/React cada vez.
2.  Una plantilla `assets/hola-mundo/` conteniendo los archivos de proyecto HTML/React sería útil para almacenar en la habilidad.

Ejemplo: al construir una habilidad `big-query` para manejar consultas como "¿Cuántos usuarios han iniciado sesión hoy?", el análisis muestra:

1.  Consultar BigQuery requiere redescubrir los esquemas de tabla y relaciones cada vez.
2.  Un archivo `references/esquema.md` documentando los esquemas de tabla sería útil para almacenar en la habilidad.

Para establecer los contenidos de la habilidad, analiza cada ejemplo concreto para crear una lista de los recursos reutilizables a incluir: scripts, referencias y activos.

### Paso 3: inicializar la habilidad

En este punto, es hora de crear realmente la habilidad.

Salta este paso solo si la habilidad que se está desarrollando ya existe, y se necesita iteración o empaquetado. En este caso, continúa al siguiente paso.

Cuando crees una nueva habilidad desde cero, siempre ejecuta el script `init_skill.py`. El script genera convenientemente un directorio de habilidad plantilla que incluye automáticamente todo lo que una habilidad requiere, haciendo el proceso de creación de habilidades mucho más eficiente y confiable.

Uso:

```bash
scripts/init_skill.py <nombre-habilidad> --path <directorio-salida>
```

El script:

-   Crea el directorio de la habilidad en la ruta especificada.
-   Genera una plantilla `SKILL.md` con frontmatter adecuado y marcadores TODO.
-   Crea directorios de recursos de ejemplo: `scripts/`, `references/` y `assets/`.
-   Agrega archivos de ejemplo en cada directorio que pueden personalizarse o eliminarse.

Después de la inicialización, personaliza o elimina el `SKILL.md` generado y los archivos de ejemplo según sea necesario.

### Paso 4: editar la habilidad

Cuando edites la habilidad (recién generada o existente), recuerda que la habilidad se está creando para que otra instancia de Claude la use. Incluye información que sería beneficiosa y no obvia para Claude. Considera qué conocimiento de procedimiento, detalles específicos de dominio o activos reutilizables ayudarían a otra instancia de Claude a ejecutar estas tareas más efectivamente.

#### Aprender patrones de diseño probados

Consulta estas guías útiles basadas en las necesidades de tu habilidad:

-   **Procesos de múltiples pasos**: ver references/workflows.md para flujos de trabajo secuenciales y lógica condicional.
-   **Formatos de salida específicos o estándares de calidad**: ver references/output-patterns.md para patrones de plantilla y ejemplo.

Estos archivos contienen mejores prácticas establecidas para el diseño efectivo de habilidades.

#### Empezar con contenidos de habilidad reutilizables

Para comenzar la implementación, empieza con los recursos reutilizables identificados anteriormente: archivos `scripts/`, `references/` y `assets/`. Ten en cuenta que este paso puede requerir entrada del usuario. Por ejemplo, al implementar una habilidad `guias-de-marca`, el usuario puede necesitar proporcionar activos de marca o plantillas para almacenar en `assets/`, o documentación para almacenar en `references/`.

Los scripts agregados deben probarse ejecutándolos realmente para asegurar que no hay errores y que la salida coincide con lo esperado. Si hay muchos scripts similares, solo una muestra representativa necesita probarse para asegurar confianza en que todos funcionan equilibrando el tiempo de finalización.

Cualquier archivo y directorio de ejemplo no necesario para la habilidad debe eliminarse. El script de inicialización crea archivos de ejemplo en `scripts/`, `references/` y `assets/` para demostrar la estructura, pero la mayoría de las habilidades no necesitarán todos ellos.

#### Actualizar SKILL.md

**Pautas de escritura:** usa siempre forma imperativa/infinitiva.

##### Frontmatter

Escribe el frontmatter YAML con `name` y `description`:

-   `name`: el nombre de la habilidad.
-   `description`: este es el mecanismo de disparo principal para tu habilidad y ayuda a Claude a entender cuándo usar la habilidad.
    -   Incluye tanto qué hace la Habilidad como disparadores/contextos específicos para cuándo usarla.
    -   Incluye toda la información de "cuándo usar" aquí - No en el cuerpo. El cuerpo solo se carga después del disparo, por lo que las secciones "Cuándo usar esta habilidad" en el cuerpo no son útiles para Claude.
    -   Descripción de ejemplo para una habilidad `docx`: "Creación, edición y análisis integral de documentos con soporte para control de cambios, comentarios, preservación de formato y extracción de texto. Usar cuando Claude necesite trabajar con documentos profesionales (.docx) para: (1) Crear nuevos documentos, (2) Modificar o editar contenido, (3) Trabajar con control de cambios, (4) Añadir comentarios, o cualquier otra tarea de documentos".

No incluyas ningún otro campo en el frontmatter YAML.

##### Cuerpo

Escribe instrucciones para usar la habilidad y sus recursos agrupados.

### Paso 5: empaquetar una habilidad

Una vez que el desarrollo de la habilidad está completo, debe empaquetarse en un archivo .skill distribuible que se comparte con el usuario. El proceso de empaquetado valida automáticamente la habilidad primero para asegurar que cumple con todos los requisitos:

```bash
scripts/package_skill.py <ruta/a/carpeta-habilidad>
```

Especificación opcional de directorio de salida:

```bash
scripts/package_skill.py <ruta/a/carpeta-habilidad> ./dist
```

El script de empaquetado:

1.  **Validará** la habilidad automáticamente, verificando:

    -   Formato de frontmatter YAML y campos requeridos.
    -   Convenciones de nombrado de habilidades y estructura de directorios.
    -   Integridad y calidad de la descripción.
    -   Organización de archivos y referencias de recursos.

2.  **Empaquetará** la habilidad si la validación pasa, creando un archivo .skill nombrado como la habilidad (ej., `mi-habilidad.skill`) que incluye todos los archivos y mantiene la estructura de directorios adecuada para distribución. El archivo .skill es un archivo zip con una extensión .skill.

Si la validación falla, el script reportará los errores y saldrá sin crear un paquete. Arregla cualquier error de validación y ejecuta el comando de empaquetado nuevamente.

### Paso 6: iterar

Después de probar la habilidad, los usuarios pueden solicitar mejoras. A menudo esto sucede justo después de usar la habilidad, con contexto fresco de cómo funcionó la habilidad.

**Flujo de trabajo de iteración:**

1.  Usa la habilidad en tareas reales.
2.  Nota dificultades o ineficiencias.
3.  Identifica cómo `SKILL.md` o los recursos agrupados deberían actualizarse.
4.  Implementa cambios y prueba nuevamente.
