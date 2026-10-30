# Centros de votación

Aplicación local para transcribir hojas manuscritas de centros de votación, revisar cada registro y generar un Excel por centro a partir de la plantilla original.

No usa APIs de pago. El reconocimiento de escritura corre en el navegador. Los nombres, DUI y teléfonos se guardan en Upstash Redis y no se envían a un servicio de OCR.

## Requisitos

- Node.js 20.9 o superior. Esta instalación se probó con Node.js 24.
- Una base **Upstash Redis** (no QStash ni Vector).
- La plantilla `.xlsx` original, cuando se vaya a exportar.

## Instalación

```bash
npm install
cp .env.example .env.local
```

Complete `.env.local`:

```env
UPSTASH_REDIS_REST_URL=https://<instancia>.upstash.io
UPSTASH_REDIS_REST_TOKEN=
APP_AUTH_SECRET=
APP_AUTH_PASSWORD=
```

`APP_AUTH_SECRET` firma la sesión y debe tener al menos 16 caracteres. `APP_AUTH_PASSWORD` es la contraseña de entrada. Si no la define, la contraseña es el mismo `APP_AUTH_SECRET`.

```bash
npm run dev
```

Abra `http://localhost:3000` e inicie sesión. La aplicación no depende de Vercel.

## Uso

1. Cree un centro con departamento, municipio, nombre, cantidad de JRV y, si hace falta, una cantidad manual de supervisores.
2. Capture personas a mano o suba fotografías JPG, PNG o WEBP de hasta 8 MB.
3. Revise cada bloque. Nada que venga del reconocimiento queda confirmado solo.
4. Confirme un registro solo cuando el nombre, el DUI (`00000000-0`) y el teléfono (`0000-0000`) estén completos. DUI y teléfono se guardan como texto.
5. Exporte el Excel del centro o un ZIP con varios centros.

Los puestos requeridos para marcar un centro como completado son: jefe titular, delegado JEM titular, un supervisor titular por cada 7 JRV (`ceil(jrv / 7)`, salvo que indique otra cantidad), orientador 1, orientador 2, y un miembro de mesa y un vigilante titulares por JRV. Los suplentes se pueden registrar y no bloquean el cierre. Esta regla está en `lib/domain/roles.ts` para poder ajustarla.

## Plantilla Excel

La aplicación no inventa coordenadas ni fabrica una plantilla parecida.

1. En **Exportaciones**, suba el `.xlsx` original. Se copia en `data/templates/centro.xlsx` y el archivo de origen no se modifica.
2. Revise los nombres de hoja y las celdas que muestra la inspección.
3. Indique la hoja y, para cada puesto, las celdas de nombre, DUI y teléfono. El mapeo se guarda en `data/excel-mapping.json`.
4. Descargue un centro o varios en ZIP. Si faltan la plantilla, el mapeo, registros confirmados o hay dos confirmados para el mismo puesto, la exportación se detiene y explica el motivo.
5. Los registros pendientes no entran en el archivo salvo que active «Incluir registros pendientes».

ExcelJS conserva lo que puede de la plantilla al copiar el libro y escribir solo los valores mapeados. DUI y teléfono reciben formato de texto (`@`). Si alguna característica de la plantilla no sobrevive al guardarla con ExcelJS, habrá que documentarla al probar el archivo real: todavía no se entregó la plantilla oficial.

## Reconocimiento de escritura

El motor es Tesseract con el idioma `spa` (español), mediante `tesseract.js` en el navegador.

- La primera vez se descarga el modelo de español. Después queda en la caché del navegador.
- Las fotografías no salen del navegador. En Redis solo se guardan metadatos de la imagen (nombre, tipo, tamaño y estado).
- Se leen las líneas detectadas y, si no hay texto, la fotografía completa. También se puede marcar un recuadro: la foto no se arrastra, el recuadro se dibuja encima.
- Va mejor con letra de molde y texto impreso. La cursiva, los sellos y los dígitos de DUI o teléfono pueden salir mal o vacíos.
- Tesseract no aporta una confianza que esta pantalla muestre como porcentaje. Cada bloque queda en **Revisar** hasta que una persona lo confirme.
- Un campo que no se reconoce queda vacío. No se agregan dígitos ni se completan nombres. Nueve dígitos seguidos se muestran como `00000000-0` porque el número ya estaba completo; un DUI más corto se conserva tal cual.

No se incluye OpenCV.js. El paquete WASM es muy grande y suele chocar con el empaquetado de Next.js. El preprocesado equivalente (escala, gris, contraste, umbral de Otsu para detectar líneas y rotación) está en `lib/ocr/segment.ts`.

## Redis

El cliente es `@upstash/redis`. Si `UPSTASH_REDIS_REST_URL` apunta a QStash o a Vector, la aplicación se detiene: no son Redis.

Claves:

| Clave | Contenido |
| --- | --- |
| `cv:centers` | Conjunto de ids de centros |
| `cv:center:{id}` | JSON del centro |
| `cv:center:{id}:records` | Ids de registros de ese centro |
| `cv:record:{id}` | JSON del registro |
| `cv:center:{id}:images` | Ids de metadatos de imagen |
| `cv:image:{id}` | Metadatos, sin pixeles |
| `cv:session:{id}` | Sesión, con vencimiento de 12 horas |
| `cv:login:attempts:{hash}` | Contador de intentos; no guarda la contraseña |

Los nombres, DUI y teléfonos no se usan como claves. El respaldo JSON está en **Respaldo** e importa registros por id sin borrar los que no vengan en el archivo.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

ESLint se ejecuta con `eslint .`. Next.js 16 ya no incluye `next lint`.

## Límites conocidos

- El OCR manuscrito no es exacto y siempre requiere revisión humana.
- La perspectiva de una foto muy inclinada no se corrige sola; use el recorte.
- Un lote admite hasta 10 imágenes, reducidas a 2200 px por el lado mayor.
- Sin la plantilla y el mapeo no hay Excel.
- La sesión dura 12 horas. Redis debe estar accesible desde la máquina donde corre Next.js.
