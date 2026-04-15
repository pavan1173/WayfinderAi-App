# Architectural Decisions

This document tracks major architectural and design decisions made for Wayfinder Ai.

## 1. Firebase as Backend
- **Decision:** Use Firebase (Firestore & Auth) for database and authentication.
- **Rationale:** Provides a serverless, NoSQL architecture that scales well and simplifies user management.

## 2. Gemini API for AI Capabilities
- **Decision:** Use the Google Gemini API for trip planning, spot extraction, and insights.
- **Rationale:** Offers powerful LLM capabilities for natural language processing and content generation.

## 3. Leaflet for Mapping
- **Decision:** Use `react-leaflet` for map visualization.
- **Rationale:** Lightweight, flexible, and well-supported for web applications.

## 4. Tailwind CSS for Styling
- **Decision:** Use Tailwind CSS for all styling.
- **Rationale:** Enables rapid, consistent, and responsive UI development.

## 5. Motion for Animations
- **Decision:** Use `motion/react` for all UI animations.
- **Rationale:** Provides a powerful, performant, and easy-to-use animation library for React.
