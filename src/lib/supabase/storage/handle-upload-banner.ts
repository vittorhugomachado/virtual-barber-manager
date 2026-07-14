import {
  handleUploadAsset,
  type HandleUploadAssetResult,
} from "./handle-upload-asset";

type HandleUploadBannerParams = {
  file: File;
  barbershopId: string;
  ownerId: string;
};

export function handleUploadBanner(
  params: HandleUploadBannerParams,
): Promise<HandleUploadAssetResult> {
  return handleUploadAsset({ ...params, type: "banner" });
}
