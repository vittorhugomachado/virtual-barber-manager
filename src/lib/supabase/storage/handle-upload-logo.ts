import {
  handleUploadAsset,
  type HandleUploadAssetResult,
} from "./handle-upload-asset";

type HandleUploadLogoParams = {
  file: File;
  barbershopId: string;
  ownerId: string;
};

export function handleUploadLogo(
  params: HandleUploadLogoParams,
): Promise<HandleUploadAssetResult> {
  return handleUploadAsset({ ...params, type: "logo" });
}
