import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { PageSpinner } from '@/components/shared/PageLoader';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { SettingsLayout } from '@/layouts/SettingsLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { GuestOnlyRoute, ProtectedRoute } from '@/routes/ProtectedRoute';

const LandingPage = lazy(() => import('@/pages/public/LandingPage'));
const LoginPage = lazy(() => import('@/pages/public/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/public/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/public/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/public/ResetPasswordPage'));
const UnauthorizedPage = lazy(() => import('@/pages/public/UnauthorizedPage'));
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'));
const PublicExposPage = lazy(() => import('@/pages/public/ExposPage'));
const PublicExpoDetailPage = lazy(() => import('@/pages/public/ExpoDetailPage'));
const AboutPage = lazy(() => import('@/pages/public/AboutPage'));
const ContactPage = lazy(() => import('@/pages/public/ContactPage'));
const StubPage = lazy(() => import('@/pages/public/StubPage'));
const PrivacyPage = lazy(() => import('@/pages/settings/PrivacyPage'));
const OrganizerDashboardPage = lazy(() => import('@/pages/organizer/OrganizerDashboardPage'));
const ExposPage = lazy(() => import('@/pages/organizer/ExposPage'));
const SchedulePage = lazy(() => import('@/pages/organizer/SchedulePage'));
const OrganizerExhibitorsPage = lazy(() => import('@/pages/organizer/ExhibitorsPage'));
const OrganizerFloorPlanPage = lazy(() => import('@/pages/organizer/FloorPlanPage'));
const OrganizerFeedbackPage = lazy(() => import('@/pages/organizer/FeedbackPage'));
const OrganizerAnalyticsPage = lazy(() => import('@/pages/organizer/AnalyticsPage'));
const OrganizerUsersPage = lazy(() => import('@/pages/organizer/UsersPage'));
const OrganizerMessagesPage = lazy(() => import('@/pages/organizer/MessagesPage'));
const ExhibitorDashboardPage = lazy(() => import('@/pages/exhibitor/ExhibitorDashboardPage'));
const ExhibitorProfilePage = lazy(() => import('@/pages/exhibitor/ProfilePage'));
const ExhibitorBoothPage = lazy(() => import('@/pages/exhibitor/BoothPage'));
const ExhibitorMessagesPage = lazy(() => import('@/pages/exhibitor/MessagesPage'));
const ExhibitorAiPage = lazy(() => import('@/pages/exhibitor/AiCopywriterPage'));
const AttendeeDashboardPage = lazy(() => import('@/pages/attendee/AttendeeDashboardPage'));
const AttendeeFloorPlanPage = lazy(() => import('@/pages/attendee/FloorPlanPage'));
const AttendeeExposPage = lazy(() => import('@/pages/attendee/ExposPage'));
const AttendeeExpoDetailPage = lazy(() => import('@/pages/attendee/ExpoDetailPage'));
const AttendeeDirectoryPage = lazy(() => import('@/pages/attendee/ExhibitorDirectoryPage'));
const AttendeeExhibitorProfilePage = lazy(() => import('@/pages/attendee/ExhibitorProfilePage'));
const AttendeeSchedulePage = lazy(() => import('@/pages/attendee/SchedulePage'));
const AttendeeMessagesPage = lazy(() => import('@/pages/attendee/MessagesPage'));
const AttendeeAiPage = lazy(() => import('@/pages/attendee/AiAssistantPage'));

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export function AppRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes location={location}>
        {/* public marketing surface */}
        <Route element={<PublicLayout />}>
          <Route
            index
            element={
              <PageTransition>
                <LandingPage />
              </PageTransition>
            }
          />
          <Route
            path="expos"
            element={
              <PageTransition>
                <PublicExposPage />
              </PageTransition>
            }
          />
          <Route
            path="expos/:expoId"
            element={
              <PageTransition>
                <PublicExpoDetailPage />
              </PageTransition>
            }
          />
          <Route
            path="about"
            element={
              <PageTransition>
                <AboutPage />
              </PageTransition>
            }
          />
          <Route
            path="contact"
            element={
              <PageTransition>
                <ContactPage />
              </PageTransition>
            }
          />
          {['terms', 'privacy-policy', 'cookies', 'accessibility'].map((slug) => (
            <Route
              key={slug}
              path={slug}
              element={
                <PageTransition>
                  <StubPage slug={slug} />
                </PageTransition>
              }
            />
          ))}
          <Route
            path="product/:slug"
            element={
              <PageTransition>
                <StubPage />
              </PageTransition>
            }
          />
          <Route path="unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* settings — any signed-in role */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="/settings/privacy" replace />} />
              <Route
                path="privacy"
                element={
                  <PageTransition>
                    <PrivacyPage />
                  </PageTransition>
                }
              />
            </Route>
          </Route>
        </Route>

        {/* auth — redirects signed-in users back to their dashboard */}
        <Route element={<GuestOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
          </Route>
        </Route>

        {/* role-scoped dashboards */}
        <Route element={<ProtectedRoute roles={['organizer']} />}>
          <Route path="organizer" element={<DashboardLayout />}>
            <Route index element={<OrganizerDashboardPage />} />
            <Route path="expos" element={<ExposPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="exhibitors" element={<OrganizerExhibitorsPage />} />
            <Route path="floor-plan" element={<OrganizerFloorPlanPage />} />
            <Route path="feedback" element={<OrganizerFeedbackPage />} />
            <Route path="analytics" element={<OrganizerAnalyticsPage />} />
            <Route path="users" element={<OrganizerUsersPage />} />
              <Route path="messages" element={<OrganizerMessagesPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['exhibitor']} />}>
          <Route path="exhibitor" element={<DashboardLayout />}>
            <Route index element={<ExhibitorDashboardPage />} />
            <Route path="profile" element={<ExhibitorProfilePage />} />
            <Route path="booth" element={<ExhibitorBoothPage />} />
            <Route path="messages" element={<ExhibitorMessagesPage />} />
            <Route path="ai" element={<ExhibitorAiPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['attendee']} />}>
          <Route path="attendee" element={<DashboardLayout />}>
            <Route index element={<AttendeeDashboardPage />} />
            <Route path="floor-plan" element={<AttendeeFloorPlanPage />} />
            <Route path="expos" element={<AttendeeExposPage />} />
            <Route path="expos/:expoId" element={<AttendeeExpoDetailPage />} />
            <Route path="exhibitors" element={<AttendeeDirectoryPage />} />
            <Route path="exhibitors/:exhibitorId" element={<AttendeeExhibitorProfilePage />} />
            <Route path="schedule" element={<AttendeeSchedulePage />} />
            <Route path="messages" element={<AttendeeMessagesPage />} />
            <Route path="ai" element={<AttendeeAiPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
