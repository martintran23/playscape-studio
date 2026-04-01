import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { getMapboxStaticImage, getMapMetrics } from "../utils/mapboxService";

const BACKDROP_ZOOM = 16;
/** Mapbox Static Images API rejects requests above 1280×1280 (HTTP 422). */
const BACKDROP_PX = 1280;

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");

/**
 * Low, wide satellite plane under the stitched terrain so streets/buildings read past the tile edge.
 * Falls back to solid green when there is no token or the static image request fails.
 */
export default function BackdropSatellite({ centerLat, centerLng, groundSize }) {
  const url = useMemo(() => {
    if (centerLat == null || centerLng == null) return "";
    return getMapboxStaticImage(centerLat, centerLng, {
      zoom: BACKDROP_ZOOM,
      width: BACKDROP_PX,
      height: BACKDROP_PX,
    });
  }, [centerLat, centerLng]);

  const planeSpan = useMemo(() => {
    const metrics = getMapMetrics(centerLat, {
      zoom: BACKDROP_ZOOM,
      width: BACKDROP_PX,
      height: BACKDROP_PX,
    });
    const mapSpan = Math.max(metrics.worldWidthMeters, metrics.worldHeightMeters);
    return Math.max(mapSpan, groundSize * 2.2);
  }, [centerLat, groundSize]);

  const [texture, setTexture] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!url) {
      setTexture((prev) => {
        if (prev) prev.dispose();
        return null;
      });
      setLoadFailed(false);
      return;
    }

    let cancelled = false;
    let loaded = null;

    setTexture((prev) => {
      if (prev) prev.dispose();
      return null;
    });
    setLoadFailed(false);

    textureLoader.load(
      url,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        loaded = tex;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 4;
        setTexture(tex);
      },
      undefined,
      () => {
        if (!cancelled) setLoadFailed(true);
      }
    );

    return () => {
      cancelled = true;
      if (loaded) loaded.dispose();
      setTexture(null);
    };
  }, [url]);

  const fallbackSize = Math.max(groundSize * 3.5, 160);
  const useFallback = !url || loadFailed || !texture;

  if (useFallback) {
    return (
      <mesh position={[0, -0.45, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[fallbackSize, fallbackSize]} />
        <meshStandardMaterial color="#7aa867" />
      </mesh>
    );
  }

  return (
    <mesh position={[0, -0.45, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[planeSpan, planeSpan]} />
      <meshStandardMaterial
        key={texture.uuid}
        map={texture}
        color="#ffffff"
        roughness={0.95}
        metalness={0}
      />
    </mesh>
  );
}
