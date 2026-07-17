import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "../types/navigation";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate(name: keyof RootStackParamList, params?: any) {
if (navigationRef.isReady()) {
(navigationRef.navigate as any)(name, params);
}
}