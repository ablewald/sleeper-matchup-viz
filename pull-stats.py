import requests
from pprint import pprint

USERNAME = '2Jar'                    # Replace with your Sleeper username
SEASON = '2025'                      # Replace with the season you want
WEEK = '2'                           # Replace with the week you want

def get_user_id(username):
    url = f'https://api.sleeper.app/v1/user/{username}'
    response = requests.get(url)
    response.raise_for_status()
    return response.json()['user_id']

def get_user_leagues(user_id, season):
    url = f'https://api.sleeper.app/v1/user/{user_id}/leagues/nfl/{season}'
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def get_matchups_for_league(league_id, week):
    url = f'https://api.sleeper.app/v1/league/{league_id}/matchups/{week}'
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def get_rosters_for_league(league_id):
    url = f'https://api.sleeper.app/v1/league/{league_id}/rosters'
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def get_display_names(league):
    """Returns dict mapping roster_id to team display name (owner or team name)"""
    roster_id_to_name = {}
    for roster in league['rosters']:
        user_id = roster.get('owner_id')
        display_name = 'Unknown'
        if user_id:
            user = next((u for u in league['users'] if u['user_id'] == user_id), {})
            display_name = user.get('display_name', 'Unknown')
        roster_id_to_name[roster['roster_id']] = display_name
    return roster_id_to_name

def main():
    user_id = get_user_id(USERNAME)
    leagues = get_user_leagues(user_id, SEASON)

    print(f'Found {len(leagues)} leagues for user "{USERNAME}" in {SEASON}.\n')

    for league in leagues:
        league_id = league['league_id']
        league_name = league.get('name', 'Unnamed League')

        try:
            matchups = get_matchups_for_league(league_id, WEEK)
            rosters = get_rosters_for_league(league_id)

            # Inject users into league object to map names
            league['rosters'] = rosters

            users_url = f'https://api.sleeper.app/v1/league/{league_id}/users'
            users = requests.get(users_url).json()
            league['users'] = users

            id_to_name = get_display_names(league)

            print(f'📊 League: {league_name}')
            matchup_groups = {}

            for matchup in matchups:
                matchup_id = matchup['matchup_id']
                if matchup_id not in matchup_groups:
                    matchup_groups[matchup_id] = []
                matchup_groups[matchup_id].append(matchup)

            for mid, group in matchup_groups.items():
                if len(group) != 2:
                    continue  # Skip bye weeks or incomplete matchups
                team1, team2 = group
                t1_name = id_to_name.get(team1['roster_id'], 'Unknown')
                t2_name = id_to_name.get(team2['roster_id'], 'Unknown')
                t1_points = team1.get('points', 0)
                t2_points = team2.get('points', 0)

                print(f" - {t1_name} ({t1_points} pts) vs {t2_name} ({t2_points} pts)")

            print()  # Spacer between leagues

        except Exception as e:
            print(f'⚠️ Error processing league {league_id}: {e}')

if __name__ == '__main__':
    main()
