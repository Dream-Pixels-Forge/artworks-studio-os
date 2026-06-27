# Artworks Studio OS

# database.md

Version: 1.0
Status: Engineering Foundation
Audience: Engineers, AI Agents, Plugin Developers

# Philosophy

The database is the heart of Artworks Studio OS.

Everything is connected.

Projects are not folders.

Projects are knowledge graphs.

Every character, scene, prompt, image, animation, document, and conversation exists as a node connected through meaningful relationships.

The database is the system’s single source of truth.

# Database Architecture

Artworks Studio OS uses a hybrid architecture.

SQLite
│
├── Structured Data
├── Metadata
├── Settings
├── Indexes
├── Version History
└── Search

+

Knowledge Graph

│
├── Nodes
├── Relationships
├── Traversal
├── Context
└── AI Reasoning

SQLite guarantees consistency.

The Knowledge Graph enables intelligence.

# Core Concepts

Everything is an Entity.

Everything can have Relationships.

Everything has History.

Everything belongs to a Project.

# Primary Entities

Project

Department

Character

Environment

Prop

FX

Material

Document

Prompt

Storyboard

Scene

Shot

Image

Video

Animation

Audio

Conversation

Task

Plugin

Template

Workflow

Render

Export

Every entity receives a permanent UUID.

Human-readable IDs remain available.

Example

CHR-001

SHOT-012

DOC-014

IMG-204

# Entity Structure

Every entity contains

uuid:
id:
name:
type:
status:
version:
created_at:
updated_at:
owner:
tags:
metadata:

# Relationships

Relationships define production.

Examples

Character

appears_in

Scene

Scene

contains

Shot

Shot

references

Camera

Prompt

generated

Image

Image

used_for

Storyboard

Character

owns

Costume

Project

contains

Characters

Relationships are directional.

Relationships are versioned.

Relationships can have metadata.

# Relationship Types

BELONGS_TO

CONTAINS

USES

GENERATED_BY

REFERENCES

DEPENDS_ON

PRECEDES

FOLLOWS

DERIVED_FROM

INSPIRED_BY

OWNS

LINKS_TO

VERSION_OF

APPROVED_BY

ASSIGNED_TO

Plugins may introduce new relationship types.

# Database Layers

## Layer 1

Projects

## Layer 2

Production

Characters

Scenes

Environments

Props

## Layer 3

Creative Assets

Images

Videos

Audio

FX

Prompts

## Layer 4

Documentation

Markdown

Templates

Specifications

## Layer 5

AI

Conversations

Memory

Context

Reasoning

# Tables

## projects

Stores

id

uuid

name

description

status

created

updated

## assets

Stores every production asset.

id

uuid

type

name

status

version

project_id

## documents

id

title

markdown

revision

asset_id

## prompts

provider

model

prompt

negative_prompt

parameters

seed

asset_id

## images

filename

resolution

provider

metadata

prompt_id

## videos

filename

duration

provider

metadata

## conversations

Stores AI conversations.

Each conversation links to

Project

Scene

Character

Department

Prompt

## workflows

Automation definitions.

## plugins

Installed extensions.

## settings

Application settings.

# Knowledge Graph

Every entity becomes a node.

Example

Ama

↓

appears_in

↓

Scene 12

↓

uses

↓

Active Pendant

↓

activates

↓

Shield

↓

generated

↓

Image 48

↓

animated_into

↓

Shot 12

Every node is queryable.

# Example Query

Find

All images

generated from

Scene 14

that use

Character

Ama

and

Active Pendant.

Graph traversal returns results instantly.

# Versioning

Nothing is overwritten.

Every modification creates a revision.

Character

↓

Version 1

↓

Version 2

↓

Version 3

History remains permanent.

# Asset References

Every asset receives

UUID

Human ID

Slug

Version

Example

UUID

0f3...

ID

CHR-001

Slug

ama

Version

3

# Search Engine

Supports

Full-text search

Metadata search

Tag search

Graph search

Relationship search

Semantic search

Future

Vector search

# AI Memory

Every AI interaction is stored.

Each memory references

Project

Scene

Character

Conversation

Prompt

Document

AI providers receive contextual memory instead of isolated prompts.

# Event Log

Every action becomes an event.

Examples

Character Updated

Prompt Generated

Image Imported

Scene Deleted

Git Commit

Plugin Installed

Supports replay.

Supports auditing.

Supports automation.

# File Synchronization

Database stores metadata.

Files remain on disk.

Database

↓

references

↓

Image

↓

stored

↓

assets/images/

Database never duplicates binary data.

# Future Database

Version 2

Graph visualization

Version 3

Vector embeddings

Semantic retrieval

Version 4

Multi-user synchronization

Version 5

Distributed production database

# Design Rules

The database owns truth.

Markdown owns documentation.

Git owns history.

The file system owns binaries.

The Knowledge Graph owns relationships.

AI owns reasoning.

No module duplicates responsibility.

# Engineering Principle

Every feature implemented in Artworks Studio OS must first exist as a database entity or relationship.

If the database cannot describe the feature, the feature does not yet belong in the application.

The data model drives the architecture.

The architecture drives the software.

Never the reverse.

End of Document
