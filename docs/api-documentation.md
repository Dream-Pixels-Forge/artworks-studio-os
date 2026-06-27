# Artworks Studio OS

# api.md

Version: 1.0
Status: Engineering Specification
Audience: Core Engineers, Plugin Developers, AI Engineers

# Overview

Artworks Studio OS is API-driven.

Every module communicates through stable service interfaces.

Internal APIs are treated with the same rigor as public APIs.

The API layer separates:

- UI

- Business Logic

- Database

- AI Providers

- Plugins

- Automation

# API Philosophy

## API First

Every feature starts with an API.

The UI is only a client.

AI agents are clients.

Plugins are clients.

Automation workflows are clients.

## Provider Independent

No API exposes provider-specific behavior.

The API abstracts implementation details.

Examples

OpenAI

Claude

Gemini

Local Models

All behave identically from the application’s perspective.

## Event Driven

Commands produce events.

Events update the Knowledge Graph.

# API Layers

Presentation API

↓

Application API

↓

Production API

↓

Knowledge Graph API

↓

Infrastructure API

# Presentation API

Used by

- Desktop UI

- Panels

- Dockable windows

Example

workspace.openProject()

workspace.openAsset()

workspace.openDocument()

workspace.showNotification()

# Project API

Purpose

Manage productions.

Example

Project.create()

Project.open()

Project.close()

Project.delete()

Project.archive()

Project.export()

# Asset API

Purpose

Manage production assets.

Example

Asset.create()

Asset.update()

Asset.delete()

Asset.find()

Asset.version()

Asset.link()

Supported Types

- Character

- Environment

- Prop

- FX

- Storyboard

- Image

- Audio

- Video

- Prompt

- Document

# Knowledge Graph API

Purpose

Manage production relationships.

Example

Graph.addNode()

Graph.removeNode()

Graph.connect()

Graph.disconnect()

Graph.find()

Graph.query()

Graph.traverse()

# Documentation API

Purpose

Manage Markdown documents.

Example

Document.create()

Document.open()

Document.save()

Document.export()

Document.render()

# Storyboard API

Purpose

Manage cinematic sequences.

Example

Storyboard.create()

Storyboard.addScene()

Storyboard.addShot()

Storyboard.moveShot()

Storyboard.render()

# Prompt API

Purpose

Generate prompts.

Example

Prompt.generate()

Prompt.validate()

Prompt.optimize()

Prompt.save()

Supported Targets

- GPT Image

- Flux

- Midjourney

- Kling

- Veo

# AI Gateway API

Purpose

Unified AI access.

Example

AI.chat()

AI.stream()

AI.cancel()

AI.models()

AI.providers()

Context

Project

Scene

Character

Department

Conversation

Prompt

Assets

# Automation API

Purpose

Background workflows.

Example

Workflow.run()

Workflow.schedule()

Workflow.cancel()

Workflow.status()

# Git API

Purpose

Version control.

Example

Git.commit()

Git.branch()

Git.checkout()

Git.merge()

Git.diff()

Git.history()

Git complexity remains hidden.

# Search API

Purpose

Search the Production Knowledge Engine.

Example

Search.assets()

Search.documents()

Search.images()

Search.graph()

Search.semantic()

# Plugin API

Purpose

Extend Artworks Studio OS.

Plugins can register

- Commands

- Panels

- Editors

- AI Providers

- Asset Types

- Automation Workflows

Example

Plugin.register()

Plugin.enable()

Plugin.disable()

Plugin.uninstall()

# Event API

Purpose

Publish production events.

Example

Event.publish()

Event.subscribe()

Event.unsubscribe()

Example Events

ProjectCreated

AssetUpdated

PromptGenerated

ImageImported

GitCommitted

WorkflowCompleted

# Settings API

Purpose

Manage application configuration.

Example

Settings.get()

Settings.set()

Settings.reset()

# File API

Purpose

Interact with local storage.

Example

File.read()

File.write()

File.move()

File.copy()

File.delete()

The application never accesses the file system directly.

Always through the File API.

# Media API

Purpose

Handle media.

Example

Media.import()

Media.export()

Media.preview()

Media.metadata()

Supported

Image

Video

Audio

3D

PDF

Markdown

# Notification API

Purpose

System notifications.

Example

Notification.info()

Notification.warning()

Notification.error()

Notification.success()

# Authentication API

Purpose

Manage providers.

Supports

- API Keys

- OAuth

- Local Authentication

Example

Auth.login()

Auth.logout()

Auth.refresh()

# SDK Philosophy

Every public API becomes part of the SDK.

Plugins should never access internal implementation.

Only documented APIs.

# API Versioning

Every API uses semantic versioning.

Example

v1

v2

v3

Breaking changes require major versions.

# Error Model

Every API returns

{
 success: boolean,
 data: any,
 error: Error | null
}

Errors are structured.

Never raw exceptions.

# Security

No API exposes

- Database internals

- File paths

- Provider secrets

- Internal objects

# Future APIs

Reserved

Cloud API

Collaboration API

Marketplace API

Telemetry API

Render Farm API

Node Graph API

Voice API

Music API

Publishing API

# API Design Rules

- Stateless where possible

- Typed interfaces

- Async by default

- Provider independent

- Event driven

- Backward compatible

- Fully documented

- Unit tested

# Engineering Principle

Every capability in Artworks Studio OS must be accessible through a documented API.

If a feature cannot be automated through an API, it is not considered complete.

The API is the contract between every layer of the system.

The desktop application, AI agents, plugins, automation engine, and future cloud services all rely on the same contracts.

This guarantees consistency, extensibility, and long-term maintainability.

End of Document
