"""Console entry point for the Artworks CLI."""

from aw.app import create_app

app = create_app()


def main() -> None:
    """Run the Artworks CLI."""

    app()


if __name__ == "__main__":
    main()
