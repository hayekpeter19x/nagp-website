# NAGP Website --- Developer Briefing & Draft Copy

## Background for the Web Developer

You are being asked to improve the website for the **North American
Gestalt Professionals (NAGP)**, a newly forming national organization
for Gestalt therapists, practitioners, and educators in the United
States.

**What is NAGP?** Gestalt therapy is a humanistic, experiential form of
psychotherapy developed in the 1950s. NAGP is being created to serve as
the professional home for Gestalt practitioners across North America ---
providing community, continuing education, professional standards, and a
national voice for the field.

**Where the organization stands right now:** NAGP is in its founding
phase. A Founding Council of five members has been meeting since
mid-2026 to establish the organization\'s structure, governance, and
programming. The Council has:

-   Held its first open community meeting (September 27, 2026) with
    Gestalt practitioners across the US

-   Established a Google Groups listserv connecting \~150+ community
    members

-   Opened a bank account and begun financial operations

-   Is actively planning its membership launch and initial programming
    (salons, presentations)

-   Expects to formally launch membership in the coming months

**Founding Council members:**

-   Steven Elkind (Chair/Presiding)

-   Ken Hutchinson

-   Galina Emmerich (Treasurer)

-   Laura Carite

-   James Battaglia (Secretary)

**The existing website (usgestalt.org):** The site exists but is
outdated. Its content primarily references a single past conference in
Chicago and does not reflect the new organization or its current
direction. The Council has decided to refresh the site rather than
rebuild from scratch. Your job is to update five specific areas
described in the sections below --- each includes the current problem
and draft copy you can use or adapt.

**Tone to aim for:** Professional but warm. Gestalt practitioners value
authenticity, presence, and human connection --- the site should feel
alive and welcoming, not corporate or clinical.

## 1. Updated Home Page Introduction

**The problem:** The current home page text refers to a past Chicago
conference and gives no sense that NAGP is a living, growing national
organization. A visitor today would have no idea what NAGP is or whether
it is still active.

**What to change:** Replace the current hero text / introductory
paragraph with the copy below. Place it prominently at the top of the
home page, ideally with the NAGP name or logo as a heading.

**Draft copy:**

> **Welcome to NAGP --- The North American Gestalt Professionals**
>
> We are a national community of Gestalt therapists, practitioners, and
> educators building a professional home for Gestalt therapy in the
> United States.
>
> NAGP is in its founding phase. A Founding Council is actively working
> to establish the organization --- developing governance, launching
> membership, and creating opportunities for Gestalt practitioners to
> connect, learn, and grow together.
>
> Whether you are a seasoned Gestalt therapist or just beginning your
> training, you belong here.

**Notes for the developer:** The existing headline referencing the
Chicago conference should be removed entirely. If there is a hero image
or banner, consider whether it can be updated to something more
evocative of community or presence rather than a specific past event.

## 2. Join / Get Notified Call to Action

**The problem:** The current site has no clear path for a visitor to
connect with NAGP. There is no sign-up form, no email list link, and no
call to action. Visitors who are interested have nowhere to go.

**What to add:** A visible \"Get Notified\" or \"Join the Community\"
section, positioned prominently on the home page (below the intro text,
or in the sidebar/header). This should collect the visitor\'s name and
email address and route them to the NAGP listserv or a holding list.

**Interim technical note:** NAGP currently uses a Google Groups listserv
as its mailing list. Until formal membership infrastructure is in place,
new sign-ups can either (a) be added manually to the Google Group by a
council member, or (b) be collected via a simple Google Form that feeds
a spreadsheet. The developer should discuss with the Council which
approach they prefer.

**Draft copy for the CTA block:**

> **Stay Connected**
>
> NAGP membership is coming soon. In the meantime, join our mailing list
> to stay informed about upcoming events, community meetings, and news
> from the Founding Council.
>
> \[First Name\] \[Last Name\] \[Email Address\] --- \[Sign Up button\]
>
> We respect your privacy. You may unsubscribe at any time.

**Notes for the developer:** The button label can be "Sign Me Up," "Join
the List," or "Get Notified" --- whatever fits the design. The Council
will confirm the technical back-end (Google Form vs. direct Google
Groups link) before launch.

## 3. Replace Conference Menu

**The problem:** The site\'s navigation includes a menu item for a past
conference (the Chicago event). This is outdated and misleading --- it
implies NAGP is primarily a conference organization, which is not
accurate, and it directs visitors to content about an event that has
already passed.

**What to change:** Remove the conference-specific menu item. Replace
the navigation structure with items that reflect the current
organization. Suggested navigation:

  -----------------------------------------------------------------------
  Menu Item                           Purpose
  ----------------------------------- -----------------------------------
  Home                                Landing page with intro and CTA

  About NAGP                          Mission, vision, brief history

  Founding Council                    Who we are (see Section 4)

  Membership                          Coming soon page (see Section 5)

  Events                              Placeholder for future programming

  Contact                             Email or contact form
  -----------------------------------------------------------------------

**Notes for the developer:** The Events page can be a simple placeholder
for now ("Upcoming events will be posted here"). The Council does not
yet have a formal programming calendar but expects to announce salons
and presentations in the coming months. Do not link to the Chicago
conference materials --- that content can be archived or removed.

## 4. About the Founding Council

**The problem:** The current site has no page or section explaining who
is leading the organization. Visitors have no way to know who is behind
NAGP or what their credentials are.

**What to add:** A \"Founding Council\" page (linked from the
navigation). This page should introduce the five Council members with
short bios. The Council will need to supply individual photos and bios
--- the copy below is a structural template and placeholder.

**Draft copy for the Founding Council page:**

> **The Founding Council**
>
> NAGP is led by a Founding Council of five Gestalt practitioners who
> are donating their time and expertise to build this organization. The
> Council is responsible for establishing NAGP\'s governance, membership
> structure, programming, and professional standards.
>
> **Steven Elkind** --- Chair \[Bio to be provided\]
>
> **Ken Hutchinson** \[Bio to be provided\]
>
> **Galina Emmerich** --- Treasurer \[Bio to be provided\]
>
> **Laura Carite** \[Bio to be provided\]
>
> **James Battaglia** --- Secretary \[Bio to be provided\]
>
> Interested in getting involved? \[Contact us.\]

**Notes for the developer:** Please create a layout that supports a
photo, name, title, and short paragraph bio for each member. A simple
card-style or two-column layout works well. The Council will send photos
and final bio text before launch --- use placeholder images and the
names/titles above in the meantime.

## 5. Coming Soon --- Membership

**The problem:** The site currently has no reference to membership.
Visitors who want to join NAGP have no information about how to do so,
what membership costs, or what they get.

**What to add:** A \"Membership\" page that sets expectations and
captures interest, even though formal membership has not yet launched.
This page should not promise specific benefits or prices that haven\'t
been finalized --- it should generate excitement and collect email
addresses.

**Draft copy for the Membership page:**

> **Membership --- Coming Soon**
>
> NAGP membership is currently in development. The Founding Council is
> working to establish membership categories, dues, and benefits that
> reflect the needs of the Gestalt community.
>
> **What to expect:**

-   A professional home for Gestalt practitioners across North America

-   Access to community events, salons, and presentations

-   Connection with colleagues who share your commitment to Gestalt
    practice

-   A voice in shaping the future of the profession

> **Charter membership opportunity:** NAGP is considering a charter
> membership category for early joiners who want to help shape the
> organization from the ground up. Details to come.
>
> Be the first to know when membership opens.
>
> \[First Name\] \[Email Address\] --- \[Notify Me button\]

**Notes for the developer:** The sign-up form here can feed the same
list as the home page CTA, or a separate \"membership interest\" list if
the Council prefers to segment by interest level. Annual dues are under
discussion --- do not publish any fee amounts until confirmed with the
Council. The phrase \"charter membership\" should be confirmed with the
Council before going live; flag it for their review. *(See comment
below.)*
