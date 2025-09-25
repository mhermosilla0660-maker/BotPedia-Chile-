# BotPedia Chile — Avatar de Voz (WebRTC + OpenAI Realtime)

Avatar conversacional **en español** para tu GPT clínico "BotPedia Chile" usando el **Realtime API** por **WebRTC**. 
Incluye backend seguro (Node/Express) que crea **tokens efímeros** y añade el **prompt de sistema** con enfoque chileno.

> ⚠️ Uso educativo/simulación: no reemplaza atención médica real. Evita dar indicaciones clínicas reales.

## Requisitos
- Node 18+
- Una API Key de OpenAI con acceso al modelo Realtime
- macOS/Windows/Linux (Chrome recomendado)

## Instalación
```bash
unzip botpedia-realtime-avatar.zip
cd botpedia-realtime-avatar
cp .env.example .env   # edita OPENAI_API_KEY
npm install
npm run start
```
Abre: http://localhost:3000

## Cómo funciona
- **/session** (backend) crea una **sesión efímera** en OpenAI Realtime:
  - Fija el modelo (`REALTIME_MODEL`, por defecto `gpt-realtime`)
  - Inserta el prompt de sistema (identidad de **BotPedia Chile**)
  - Devuelve `client_secret.value` que el frontend usa para negociar WebRTC

- **Frontend** (`public/`) establece una **PeerConnection** con el Realtime API:
  - Envía tu micrófono y reproduce el **audio del modelo**
  - Muestra un VU meter simple
  - Botones: Conectar / Silenciar / Colgar

## Personalización rápida
- Cambia la voz en `server.js` (`voice: "alloy"`) si tu cuenta dispone de otras voces compatibles.
- Ajusta el prompt de sistema `botpediaSystemPrompt` para tus protocolos locales.
- Si quieres **avatar con cara** (lab-sync), incrusta el canvas/iframe de un proveedor (HeyGen/D-ID) y enruta el audio de salida del modelo.

## Añadir conocimientos propios (documentos)
1. Sube tus guías/protocolos a OpenAI (File Search/Retrieval) desde el **backend** (recomendado) y enlázalos a conversaciones Realtime.
2. Alternativa simple: copia resúmenes a tu `botpediaSystemPrompt`. 
3. Mantén siempre el **descargo de responsabilidad** y limita a simulación educativa.

## Problemas comunes
- *No se escucha nada*: revisa permisos de micrófono y que no esté silenciado.
- *403/401*: tu OPENAI_API_KEY es inválida o no tiene acceso Realtime.
- *No establece conexión*: prueba en Chrome o desactiva VPNs/firewalls empresariales.

## Producción
- Sirve detrás de HTTPS y configura CORS.
- Nunca expongas tu API Key en el frontend; usa siempre el endpoint `/session`.
