import type { Adapter } from "next-auth/adapters";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// @auth/prisma-adapter ships its own nested @auth/core type definitions, which
// TypeScript treats as structurally distinct from next-auth v4's Adapter type
// even though they are compatible at runtime. Cast to bridge the two.
const prismaAdapter = PrismaAdapter(prisma) as unknown as Adapter;

export const authOptions: NextAuthOptions = {
  adapter: prismaAdapter,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        // الحسابات المعطّلة (soft disable) لا تستطيع تسجيل الدخول.
        if (!user.isActive) return null;

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValidPassword) return null;

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.invalid = false;
        return token;
      }

      // على كل طلب لاحق: نتأكد أن المستخدم ما زال موجودًا ونشطًا، ونحدّث دوره.
      // هذا يُبطل الجلسات القديمة (مستخدم محذوف بعد reset) أو المعطّلة فورًا.
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, isActive: true },
        });
        if (!dbUser || !dbUser.isActive) {
          token.invalid = true;
        } else {
          token.role = dbUser.role;
          token.invalid = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.invalid || !token.id) {
        // جلسة لمستخدم لم يعد صالحًا — تُعاد بلا مستخدم لإجبار تسجيل دخول جديد.
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as typeof session.user.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
