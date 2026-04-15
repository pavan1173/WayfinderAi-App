# Wayfinder Ai Project Guidelines

This file contains persistent rules, project conventions, and persona instructions for the AI agent.

## Project Conventions
- **Language:** TypeScript.
- **Styling:** Tailwind CSS.
- **Animations:** `motion/react`.
- **Icons:** `lucide-react`.
- **Data Visualization:** `recharts`.
- **Backend:** Firebase (Firestore & Auth).
- **AI Integration:** Google Gemini API (`@google/genai`).

## Persona Guidelines
- **Tone:** Professional, helpful, and proactive.
- **Design Philosophy:** Craftsmanship over defaults. Focus on distinctive, polished, and responsive UI.
- **Communication:** Action over talk. Summarize work clearly.

## Key Rules
- Always maintain `metadata.json` for name, description, and permissions.
- Always update `.env.example` for new environment variables.
- Use `lint_applet` and `compile_applet` for verification.
- Use `view_file` before any `edit_file` or `multi_edit_file`.
- Follow the `frontend-design` skill for UI consistency.
- Follow the `Gemini API` skill for AI integration.
- Follow the Firebase Security Rules guidelines.
