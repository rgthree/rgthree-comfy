# https://stackoverflow.com/questions/4842424/list-of-ansi-color-escape-sequences
COLORS_FG = {
    'BLACK': '\33[30m',
    'RED': '\33[31m',
    'GREEN': '\33[32m',
    'YELLOW': '\33[33m',
    'BLUE': '\33[34m',
    'VIOLET': '\33[35m',
    'BEIGE': '\33[36m',
    'WHITE': '\33[37m',

    'GREY': '\33[90m',
    'LIGHTRED': '\33[91m',
    'LIGHTGREEN': '\33[92m',
    'LIGHTYELLOW': '\33[93m',
    'LIGHTBLUE': '\33[94m',
    'LIGHTVIOLET': '\33[95m',
    'LIGHTBEIGE': '\33[96m',
    'LIGHTWHITE': '\33[97m',
}
COLORS_STYLE = {
    'RESET': '\33[0m',
    'BOLD': '\33[1m',
    'NORMAL': '\33[22m',
    'ITALIC': '\33[3m',
    'UNDERLINE': '\33[4m',
    'BLINK': '\33[5m',
    'BLINK2': '\33[6m',
    'SELECTED': '\33[7m',
}
COLORS_BG = {
    'BLACKBG': '\33[40m',
    'REDBG': '\33[41m',
    'GREENBG': '\33[42m',
    'YELLOWBG': '\33[43m',
    'BLUEBG': '\33[44m',
    'VIOLETBG': '\33[45m',
    'BEIGEBG': '\33[46m',
    'WHITEBG': '\33[47m',

    'GREYBG': '\33[100m',
    'LIGHTREDBG': '\33[101m',
    'LIGHTGREENBG': '\33[102m',
    'LIGHTYELLOWBG': '\33[103m',
    'LIGHTBLUEBG': '\33[104m',
    'LIGHTVIOLETBG': '\33[105m',
    'LIGHTBEIGEBG': '\33[106m',
    'LIGHTWHITEBG': '\33[107m',
}

def log_welcome(num_nodes=None):
    msg='{}{}rgthree\'s comfy nodes:{}{} Loaded'.format(COLORS_FG['GREEN'], COLORS_STYLE['BOLD'], COLORS_STYLE['RESET'], COLORS_STYLE['BOLD'])
    if num_nodes:
        print('{} {} exciting nodes.{}'.format(msg, num_nodes, COLORS_STYLE['RESET']))
    else:
        print('{}.{}'.format(msg, COLORS_STYLE['RESET']))
