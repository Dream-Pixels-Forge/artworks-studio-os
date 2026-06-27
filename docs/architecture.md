# Artworks Studio OS

# architecture.md

Version: 1.0
Status: Foundation
Audience: Engineering, AI Agents, Plugin Developers

# Overview

Artworks Studio OS is a modular desktop application designed specifically for AI-native filmmaking.

The platform is built around a local-first architecture where every production is represented as a structured knowledge graph composed of interconnected assets, documents, prompts, AI conversations, and generated media.

Unlike traditional creative software, Artworks Studio OS does not revolve around files.

It revolves around productions.

# Architectural Principles

## Modular

Every major feature exists as an independent module.

Modules communicate through an event bus rather than direct dependencies.

## Local First

Projects are stored locally.

Users own their productions.

Cloud synchronization is optional.

## AI Native

Artificial Intelligence is integrated into the architecture.

Every department can be powered by one or more AI providers.

## Extensible

Every feature should be replaceable through plugins.

No module should require modifications to the application core.

## Production Centric

Everything belongs to a production.

There are no isolated assets.

Characters, prompts, images, scenes, and documents always belong to a project.

# High Level Architecture

+-------------------------+
 | Desktop Shell |
 +-----------+-------------+
 |
 +-----------------+-----------------+
 | |
 Presentation Layer AI Workspace
 | |
+--------------+-------------+ +-----------+-----------+
| | | |
Project Manager Asset Manager AI Gateway Prompt Engine
| | | |
+--------------+-------------+ +-----------+-----------+
 | |
 +-----------------+-----------------+
 |
 Production Core
 |
 +----------------+----------------+
 | |
 Knowledge Graph Event Bus
 | |
 Repository Engine Plugin System
 | |
 Git Integration Local Database
 |
 File System

# Layer Architecture

## Presentation Layer

Responsibilities

- Desktop UI

- Docking System

- Editors

- Panels

- Workspace Layout

- Themes

Contains no business logic.

## Application Layer

Coordinates user actions.

Examples

- Create Project

- Import Assets

- Generate Prompt

- Open Storyboard

Acts as the controller between UI and services.

## Domain Layer

Contains production logic.

Examples

- Character Rules

- Asset Relationships

- Prompt Generation

- Scene Validation

- Continuity Checks

No UI code.

No AI provider code.

## Infrastructure Layer

Responsible for

- File System

- Git

- Databases

- APIs

- Networking

- Plugin Loading

# Core Modules

## Project Manager

Responsible for

- Creating productions

- Opening projects

- Project settings

- Metadata

- Archives

## Documentation Engine

Responsible for

- Markdown

- Templates

- Production Bibles

- Version history

## Asset Manager

Handles

- Characters

- Props

- Environments

- Concepts

- Images

- Videos

- Audio

Every asset has a unique ID.

## Knowledge Graph

The heart of the platform.

Every object becomes a node.

Examples

Character

↓

Scene

↓

Prompt

↓

Animation

↓

Render

Relationships are queryable.

## Prompt Engine

Generates prompts from production data.

Supports

- GPT Image

- Flux

- Midjourney

- Kling

- Veo

- Future providers

Prompt generation becomes deterministic.

## AI Gateway

Single interface for all AI providers.

Responsibilities

- Authentication

- Conversations

- Context management

- Provider abstraction

Switch providers without changing application logic.

## Storyboard Engine

Responsible for

- Scene planning

- Shot organization

- Camera continuity

- Asset linking

## Production Engine

Coordinates all production stages.

Tracks

Development

Preproduction

Production

Post

Publishing

## Git Engine

Native Git support.

Features

- Commit

- Branch

- Merge

- History

- Asset revisions

Invisible to non-technical users.

## Plugin Engine

Loads external extensions.

Supports

- UI Panels

- AI Providers

- Exporters

- Automation

- Asset Types

## Automation Engine

Background workflows.

Examples

- Update documentation

- Rename assets

- Validate projects

- Generate prompts

- Sync metadata

# Event Bus

Modules never communicate directly.

Example

Character Updated

↓

Event Bus

↓

Storyboard Engine

↓

Prompt Engine

↓

Production Manager

↓

Git Engine

Loose coupling.

Maximum extensibility.

# Knowledge Graph

Every object is a node.

Examples

Project

Character

Environment

Scene

Shot

Prompt

Image

Animation

Video

Document

Version

Relationship examples

Character

appears_in

Scene

uses

Prop

generated_by

Prompt

belongs_to

Project

# Data Storage

Projects

Markdown

JSON

SQLite

Git Repository

Generated Assets

Images

Videos

Audio

Everything remains human-readable whenever possible.

# AI Architecture

AI is provider independent.

Creative Director

↓

AI Gateway

↓

OpenAI

Claude

Gemini

Local Models

Future Providers

No module depends on one provider.

# Plugin Architecture

Every plugin exposes

Metadata

Capabilities

Commands

Panels

Events

Plugins can add

- AI providers

- Asset generators

- Editors

- Exporters

- Validation tools

# File Structure

Project
│
├── docs/
├── assets/
├── prompts/
├── storyboards/
├── keyframes/
├── renders/
├── audio/
├── exports/
├── automation/
└── project.json

# Future Architecture

Version 2

Knowledge Graph Visualization

Version 3

Node-Based Production Pipeline

Version 4

Collaborative Multi-User Editing

Version 5

Distributed AI Production Teams

# Guiding Rule

The architecture should make adding new AI providers, new production departments, and new creative workflows possible without modifying the application core.

Every system should be replaceable.

Every module should be reusable.

Every production should remain portable.

# Engineering Philosophy

Artworks Studio OS is not a collection of tools.

It is a production platform.

The architecture is designed so that every completed film enriches the platform itself through reusable assets, templates, workflows, and production knowledge.

The operating system grows alongside the filmmaker.

End of Document
