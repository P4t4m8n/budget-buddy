import "server-only";
import { prisma } from "@/lib/prisma";
import { hashGoogleId } from "./crypto";
import type { GoogleProfile } from "./google";

export const upsertGoogleUser = (profile: GoogleProfile) => {
  const googleIdHash = hashGoogleId(profile.sub);

  return prisma.user.upsert({
    where: { googleIdHash },
    create: {
      googleIdHash,
      email: profile.email,
      name: profile.name,
      image: profile.picture,
    },
    update: {
      email: profile.email,
      name: profile.name,
      image: profile.picture,
    },
  });
};
