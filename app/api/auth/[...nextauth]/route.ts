import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "E-mailadres", type: "text" },
        password: { label: "Wachtwoord", type: "password" },
      },
      async authorize(credentials) {
        const validUsername = process.env.AUTH_USERNAME;
        const validPassword = process.env.AUTH_PASSWORD;

        if (!validUsername || !validPassword) return null;

        if (
          credentials?.username === validUsername &&
          credentials?.password === validPassword
        ) {
          return { id: "1", name: "BezwaarPilot", email: validUsername };
        }
        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
