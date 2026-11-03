import { Link } from "@tanstack/react-router";
import { LegalPage, Secao } from "@/components/legal-page";
import { EMPRESA, identificacaoEmpresa } from "@forja/app-core/lib/legal";

/**
 * Termos de Uso em inglês — tradução de `routes/termos.tsx`. Ao mudar o texto
 * em português, atualize aqui e na versão em espanhol (revisão jurídica).
 */
export function TermosEn() {
  return (
    <LegalPage
      titulo="Terms of Use"
      resumo={
        <>
          <strong>In short:</strong> Habitual Fit helps you organize and track your workouts,
          nutrition and progress. It <strong>does not replace</strong> the guidance of a certified
          trainer, a nutritionist or a doctor. Your data is yours, and you can close your account
          whenever you want.
          <br />
          <br />
          <em>
            This is a translation of the original Portuguese version. In case of any conflict, the
            Portuguese version prevails.
          </em>
        </>
      }
    >
      <Secao titulo="1. Acceptance">
        <p>
          These Terms govern the use of the Habitual Fit app, offered by{" "}
          <strong>{identificacaoEmpresa()}</strong>. By creating an account or using the app, you
          agree to these Terms and confirm that you have read the{" "}
          <Link to="/privacidade">Privacy Policy</Link>. If you do not agree, do not use the app.
        </p>
      </Secao>

      <Secao titulo="2. What the app offers">
        <p>
          Habitual Fit lets you build and log workout routines, organize meals, log weight and
          measurements and track your progress. Based on your answers to the initial questionnaire,
          the app automatically suggests a workout plan, which you can use, adjust or discard.
        </p>
      </Secao>

      <Secao titulo="3. The app is not professional advice">
        <ul>
          <li>
            The suggested workout plan is a <strong>general guide</strong>, generated automatically,
            and not an individual prescription. It does not replace assessment and follow-up by a
            certified trainer.
          </li>
          <li>
            The app <strong>does not prescribe diets</strong>. Meal planning — what, how much and
            when to eat — should be guided by a nutritionist.
          </li>
          <li>
            If you report an injury or pain, the app leaves out exercises that load that area, but
            this is not a clinical assessment and does not guarantee that an exercise is safe for
            you. Before training with an injury, pain or any health condition, see a health
            professional.
          </li>
          <li>
            Physical activity involves risks. Respect your limits and stop exercising if you feel
            pain, dizziness, shortness of breath or any discomfort.
          </li>
        </ul>
      </Secao>

      <Secao titulo="4. Your account">
        <ul>
          <li>
            To create an account, you must be at least 14 years old; if you are under 18, you need
            the permission of your parents or guardians.
          </li>
          <li>Provide true information and keep your password secret.</li>
          <li>
            You are responsible for what happens in your account. If you notice unauthorized access,
            change your password and let us know at{" "}
            <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>.
          </li>
        </ul>
      </Secao>

      <Secao titulo="5. Permitted use">
        <p>When using the app, you agree not to:</p>
        <ul>
          <li>break the law or violate other people's rights;</li>
          <li>try to access other accounts' data or restricted parts of the system;</li>
          <li>overload, bulk copy, reverse engineer or interfere with how the app works;</li>
          <li>
            upload illegal or offensive content, or content that violates third-party rights, such
            as photos or recipes.
          </li>
        </ul>
      </Secao>

      <Secao titulo="6. Your content">
        <p>
          The data and content you log in the app (workouts, meals, recipes, photos, measurements)
          remain yours. You authorize us to store and process them only to provide the service to
          you, as described in the <Link to="/privacidade">Privacy Policy</Link>. You can export or
          delete them at any time under <strong>Menu → Data and account</strong>.
        </p>
      </Secao>

      <Secao titulo="7. Intellectual property">
        <p>
          The app, its brand, design, texts and its exercise and food catalog belong to{" "}
          {EMPRESA.nome} or its licensors. These Terms do not transfer any of these rights to you,
          only the permission to use the app for personal purposes.
        </p>
      </Secao>

      <Secao titulo="8. Availability and changes">
        <p>
          We work to keep the app available and working well, but it may experience interruptions,
          maintenance or failures. We may add, change or remove features over time.
        </p>
      </Secao>

      <Secao titulo="9. Price">
        <p>
          Habitual Fit is currently free to use. If paid plans are offered in the future, prices and
          conditions will be clearly presented before any charge, and nothing will be charged
          without your express purchase.
        </p>
      </Secao>

      <Secao titulo="10. Liability">
        <p>
          To the extent permitted by law, including the Brazilian Consumer Protection Code, we are
          not responsible for training or nutrition results, nor for damages arising from using the
          app's suggestions without professional supervision, from incorrect information you
          provide, or from use contrary to these Terms.
        </p>
      </Secao>

      <Secao titulo="11. Termination">
        <p>
          You can delete your account at any time under <strong>Menu → Data and account</strong>. We
          may suspend or terminate accounts that violate these Terms, notifying you whenever
          possible.
        </p>
      </Secao>

      <Secao titulo="12. Changes to these Terms">
        <p>
          We may update these Terms. The date at the top shows the version in force, and relevant
          changes will be announced in the app before taking effect. Continuing to use the app after
          that means you agree to the new version.
        </p>
      </Secao>

      <Secao titulo="13. Governing law and jurisdiction">
        <p>
          These Terms are governed by Brazilian law. The courts of your place of residence are
          chosen to resolve any matter related to them.
        </p>
      </Secao>
    </LegalPage>
  );
}
