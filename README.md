# Pizza Dash Web Deluxe

Juego web 2D creado únicamente con HTML, CSS y JavaScript.

## Ejecutar en Visual Studio Code

### Opción 1: Live Server

1. Abre la carpeta `PizzaDashWebDeluxe` en VS Code.
2. Abre `index.html`.
3. Haz clic en **Go Live** o clic derecho → **Open with Live Server**.

### Opción 2: servidor local sin instalar nada

Abre la terminal dentro de la carpeta y ejecuta:

```bash
python3 -m http.server 5500
```

Luego abre:

```text
http://localhost:5500
```

### Opción 3: abrir directamente

Haz doble clic sobre `index.html`. El juego también funciona de esta forma.

## Importante

No ejecutes `npm install`. Este proyecto no usa Node, paquetes ni `package.json`.

## Controles

- `WASD` o flechas: mover.
- `Shift`: correr.
- `E` o `Espacio`: entregar pizza.
- `Escape`: pausar.
- También incluye controles táctiles para teléfono o tableta.

## Contenido

- Menú principal y pantalla de instrucciones.
- Selector de tres niveles.
- Barrio Soleado.
- Parque Central.
- Ciudad Nocturna con lluvia.
- Personaje animado.
- Casas y marcador de entrega.
- Tráfico, gatos, charcos y obstáculos.
- Monedas, puntuación, vidas y temporizador.
- Efectos visuales y sonidos creados con JavaScript.
- Pantallas de victoria, derrota y pausa.
- Guardado local de estrellas por nivel.

## Archivos

```text
PizzaDashWebDeluxe/
├── index.html
├── styles.css
├── assets/
│   ├── shared/
│   │   └── progress.js
│   ├── menu/
│   └── levels/
│       ├── level-1/
│       │   ├── index.html
│       │   ├── game.js
│       │   └── level.css
│       ├── level-2/
│       │   ├── index.html
│       │   ├── game.js
│       │   └── level.css
│       ├── level-3/
│       │   ├── index.html
│       │   ├── game.js
│       │   └── level.css
│       └── level-4/
│           ├── index.html
│           ├── game.js
│           └── level.css
├── start.command
├── start.bat
├── AGENTS.md
└── README.md
```

El menú principal vive en `index.html`. Cada nivel tiene su propia página,
implementación y estilos en `assets/levels/level-N/`. La lógica compartida se
limita a progreso global en `assets/shared/progress.js`.
