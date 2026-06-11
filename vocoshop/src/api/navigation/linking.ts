// src/navigation/linking.ts
import * as Linking from "expo-linking";

export const linking = {
  prefixes: [
    Linking.createURL(""),
    "vocoshop://",
    "exp://172.20.10.11:8081",
    "https://unglozed-supermetropolitan-tamar.ngrok-free.dev",
  ],
  config: {
    screens: {
      Invite: {
        path: "invite",
        parse: {
          token: (token: string) => token,
        },
      },
      Login: "login",
      Home: "home",
    },
  },
};
