import { Link } from "@tanstack/react-router";
import { LegalPage, Secao } from "@/components/legal-page";
import { EMPRESA, identificacaoEmpresa } from "@forja/app-core/lib/legal";

/**
 * Política de Privacidade em inglês — tradução de `routes/privacidade.tsx`.
 * Ao mudar o texto em português, atualize aqui e na versão em espanhol
 * (revisão jurídica; antes de liberar a UE, revisar também à luz do GDPR).
 */
export function PrivacidadeEn() {
  return (
    <LegalPage
      titulo="Privacy Policy"
      resumo={
        <>
          <strong>In short:</strong> we use your data only to make Habitual Fit work for you — build
          your workout, log your diet and show your progress. We don't sell your data, we don't show
          ads and we don't use third-party tracking tools. You can export or delete everything at
          any time, right in the app.
          <br />
          <br />
          <em>
            This is a translation of the original Portuguese version. In case of any conflict, the
            Portuguese version prevails.
          </em>
        </>
      }
    >
      <Secao titulo="1. Who we are">
        <p>
          Habitual Fit is an app to organize and track workouts, nutrition and body progress,
          offered by <strong>{identificacaoEmpresa()}</strong>, which is the controller of your
          personal data under the Brazilian General Data Protection Law (Law No. 13,709/2018, the
          LGPD).
        </p>
        <p>
          For any matter about your data, including contacting the data protection officer, write to{" "}
          <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>.
        </p>
      </Secao>

      <Secao titulo="2. What data we collect">
        <p>We only collect what you tell us or log while using the app:</p>
        <ul>
          <li>
            <strong>Account:</strong> name, email and password. The password is stored encrypted and
            no one on the team has access to it. If you sign in with Google, we receive from Google
            only your name, email and profile photo.
          </li>
          <li>
            <strong>Profile and initial questionnaire:</strong> sex, age or date of birth, height,
            weight, weight goal, objective, experience level, training place and equipment,
            available days and duration, area you want to prioritize and number of meals.
          </li>
          <li>
            <strong>Health information you choose to provide:</strong> injuries or pain, health
            conditions, allergies and dietary restrictions.
          </li>
          <li>
            <strong>What you log:</strong> workouts (exercises, sets, reps, weights and dates),
            routines, meals and foods, water intake, weigh-ins and body measurements, recipes you
            create, favorite exercises and your profile photo.
          </li>
          <li>
            <strong>Technical data:</strong> what is needed to keep you securely signed in. Your
            browser also stores on your device preferences such as the theme (light or dark) and the
            questionnaire draft — these stay only with you.
          </li>
        </ul>
        <p>We don't use advertising cookies or third-party analytics or tracking tools.</p>
      </Secao>

      <Secao titulo="3. Health data">
        <p>
          Weight, measurements, injuries, pain, health conditions and allergies are{" "}
          <strong>sensitive personal data</strong> under the LGPD. They are only processed because
          you choose to provide them, with your consent, and only to build your workout plan,
          organize your nutrition and show your progress. You can change or delete them whenever you
          want, and withdraw your consent at any time — in that case, features that depend on this
          data may stop working as before.
        </p>
      </Secao>

      <Secao titulo="4. What we use your data for">
        <ul>
          <li>Create and maintain your account and let you sign in to the app.</li>
          <li>
            Build the suggested workout plan from your answers — it is a general guide, generated
            automatically, and not an individual assessment.
          </li>
          <li>Log and show your workouts, your diet and your progress.</li>
          <li>Protect the service against fraud, abuse and unauthorized access.</li>
          <li>Respond to your messages and support requests.</li>
          <li>Comply with legal and regulatory obligations.</li>
        </ul>
        <p>
          We don't sell, rent or share your data for advertising, and we don't use it to build
          consumer profiles.
        </p>
      </Secao>

      <Secao titulo="5. Legal bases">
        <ul>
          <li>
            <strong>Performance of a contract</strong> (art. 7, V, of the LGPD): to provide the
            service you signed up for when creating your account.
          </li>
          <li>
            <strong>Consent</strong> (art. 11, I): for the health data you decide to provide.
          </li>
          <li>
            <strong>Legitimate interest</strong> (art. 7, IX): for security and abuse prevention.
          </li>
          <li>
            <strong>Compliance with a legal obligation</strong> (art. 7, II): for example, keeping
            the access logs required by the Brazilian Internet Civil Framework (Marco Civil da
            Internet).
          </li>
        </ul>
      </Secao>

      <Secao titulo="6. Who we share it with">
        <p>
          Your data is not sold or shared with advertisers. It only passes through providers that
          help us operate the app, under contract and only for that purpose:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — database, authentication and file storage (such as the
            profile photo).
          </li>
          <li>
            <strong>Vercel</strong> — app hosting.
          </li>
          <li>
            <strong>Google</strong> — only if you choose to sign in with your Google account, to
            confirm your identity.
          </li>
        </ul>
        <p>
          We may also share data when required by law or by order of a competent authority. When you
          use the option to share your profile, the app generates an image on your device with only
          the information you select; it only leaves the app if you send it yourself. There is no
          public page for your profile.
        </p>
      </Secao>

      <Secao titulo="7. International transfer">
        <p>
          Our providers' servers may be located outside Brazil, including in the United States. For
          these transfers we require data protection safeguards compatible with the LGPD (art. 33).
        </p>
      </Secao>

      <Secao titulo="8. How long we keep it">
        <p>
          We keep your data while your account exists. When you delete your account, we delete your
          data and files. Backup copies that are automatically overwritten may remain for a limited
          time, as well as records the law requires us to keep — such as application access logs,
          kept for 6 months (art. 15 of the Brazilian Internet Civil Framework).
        </p>
      </Secao>

      <Secao titulo="9. Your rights">
        <p>Under the LGPD (art. 18), you can, at any time:</p>
        <ul>
          <li>confirm whether we process your data and access it;</li>
          <li>correct incomplete, inaccurate or outdated data;</li>
          <li>request anonymization, blocking or deletion of data;</li>
          <li>request the portability of your data;</li>
          <li>know who we share your data with;</li>
          <li>withdraw the consent given for health data.</li>
        </ul>
        <p>
          You can do most of this yourself in the app: edit your data in <strong>Profile</strong>{" "}
          and, under <strong>Menu → Data and account</strong>, export a copy of everything or delete
          your account permanently. For other requests, write to{" "}
          <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a> — we reply within 15 days. You can
          also file a complaint with the Brazilian National Data Protection Authority (ANPD).
        </p>
      </Secao>

      <Secao titulo="10. Security">
        <p>
          All communication with the app is encrypted (HTTPS), the password is stored encrypted and
          each person only has access to their own data — the rule is enforced in the database
          itself, not just on screen. No system is completely immune to failures; if a security
          incident occurs that may put you at risk, we will notify you and the ANPD, as the law
          requires.
        </p>
      </Secao>

      <Secao titulo="11. Children and teenagers">
        <p>
          Habitual Fit is not intended for children under 14. Teenagers between 14 and 17 should
          only use it with the consent and supervision of their parents or guardians.
        </p>
      </Secao>

      <Secao titulo="12. Changes to this policy">
        <p>
          We may update this policy when the app changes — for example, when launching new features.
          The date at the top of the page shows the version in force, and relevant changes will be
          announced in the app before taking effect. See also the{" "}
          <Link to="/termos">Terms of Use</Link>.
        </p>
      </Secao>
    </LegalPage>
  );
}
