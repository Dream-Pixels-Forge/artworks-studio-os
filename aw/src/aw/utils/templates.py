"""Bundled template rendering for scaffolding production artifacts.

Templates live under :mod:`aw.templates` and are packaged with the wheel.
Rendering uses simple ``__PLACEHOLDER__`` token substitution (no Jinja)
to avoid pulling in an extra dependency.
"""

from importlib.resources import files

PlaceholderMap = dict[str, str]


def read_template(group: str, name: str) -> str:
    """Read a bundled template as text.

    Args:
        group: Template group, e.g. ``"project"`` or ``"documentation"``.
        name: Template file name, e.g. ``"project.json"``.

    Returns:
        The raw template contents.

    Raises:
        FileNotFoundError: If the template does not exist.
    """

    resource = files("aw.templates").joinpath(group, name)
    return resource.read_text(encoding="utf-8")


def render(template_text: str, context: PlaceholderMap | None = None) -> str:
    """Substitute ``__TOKEN__`` placeholders in a template.

    Args:
        template_text: Raw template text containing ``__TOKEN__`` markers.
        context: Mapping of token name (without underscores) to value.

    Returns:
        The rendered text with known placeholders replaced.
    """

    if not context:
        return template_text

    rendered = template_text
    for key, value in context.items():
        rendered = rendered.replace(f"__{key}__", str(value))
    return rendered


def render_template(
    group: str, name: str, context: PlaceholderMap | None = None
) -> str:
    """Read and render a bundled template in one step.

    Args:
        group: Template group.
        name: Template file name.
        context: Placeholder values.

    Returns:
        The rendered text.
    """

    return render(read_template(group, name), context)
