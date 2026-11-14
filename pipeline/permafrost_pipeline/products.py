"""Local product readers with explicit metadata checks.

Downloads are intentionally separate from processing so Earthdata/CDS credentials
never enter the repository. The readers accept already downloaded files and fail
closed when required correction layers or provenance fields cannot be found.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class ProductInventoryItem:
    path: str
    mission: str
    acquisition_start: str | None
    acquisition_end: str | None
    maturity: str | None
    processing_version: str | None
    has_corrections: bool
    warnings: tuple[str, ...]


def _first_attr(handle: object, names: Iterable[str]) -> str | None:
    attrs = getattr(handle, "attrs", {})
    for name in names:
        if name in attrs:
            value = attrs[name]
            if isinstance(value, bytes):
                value = value.decode("utf-8", errors="replace")
            return str(value)
    return None


def inspect_nisar_gunw(path: str | Path) -> ProductInventoryItem:
    try:
        import h5py
    except ImportError as exc:  # pragma: no cover - optional dependency guard
        raise RuntimeError("Install pipeline dependencies to inspect HDF5 products") from exc

    product_path = Path(path)
    correction_tokens = ("ionosphere", "troposphere", "solidEarthTide")
    warnings: list[str] = []
    with h5py.File(product_path, "r") as handle:
        dataset_paths: list[str] = []
        handle.visit(dataset_paths.append)
        lowered = [name.lower() for name in dataset_paths]
        has_corrections = all(any(token.lower() in name for name in lowered) for token in correction_tokens)
        if not has_corrections:
            warnings.append("One or more required correction layers were not located; do not export displacement.")
        processing_version = _first_attr(handle, ("productVersion", "processing_version", "crid"))
        if processing_version is None:
            warnings.append("Processing version/CRID not found in root attributes; inspect product metadata.")
        maturity = _first_attr(handle, ("productMaturity", "product_maturity", "maturity"))
        return ProductInventoryItem(
            path=str(product_path.resolve()),
            mission="NISAR",
            acquisition_start=_first_attr(handle, ("zeroDopplerStartTime", "acquisition_start")),
            acquisition_end=_first_attr(handle, ("zeroDopplerEndTime", "acquisition_end")),
            maturity=maturity,
            processing_version=processing_version,
            has_corrections=has_corrections,
            warnings=tuple(warnings),
        )


def inspect_opera_disp(path: str | Path) -> ProductInventoryItem:
    try:
        import rasterio
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("Install pipeline dependencies to inspect GeoTIFF products") from exc

    product_path = Path(path)
    with rasterio.open(product_path) as dataset:
        tags = dataset.tags()
        warnings: list[str] = []
        if dataset.crs is None:
            warnings.append("Product has no CRS and cannot enter the common-grid workflow.")
        return ProductInventoryItem(
            path=str(product_path.resolve()),
            mission="OPERA DISP-S1",
            acquisition_start=tags.get("reference_datetime") or tags.get("acquisition_start"),
            acquisition_end=tags.get("secondary_datetime") or tags.get("acquisition_end"),
            maturity=tags.get("product_maturity"),
            processing_version=tags.get("product_version"),
            has_corrections=True,
            warnings=tuple(warnings),
        )
