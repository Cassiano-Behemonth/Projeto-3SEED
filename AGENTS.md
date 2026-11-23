# Instruções para agentes de IA

Este projeto é uma semente de mapas 3D para RPG de mesa. O que mais se pede a um agente aqui é: **receber a imagem de uma planta e entregar a primeira versão do mapa**, que a pessoa depois ajusta no editor. O formato e todos os detalhes estão em `GUIA_DE_MAPAS.md`; leia-o antes de escrever o arquivo. O guia é longo (mais de 500 linhas) e uma leitura só vem cortada: veja os títulos com `grep -n "^##" GUIA_DE_MAPAS.md` e leia por partes (`offset`/`limit`), começando por "Formato do arquivo" e pelas seções que o Passo 0 indicar. `README.md` tem os pedidos prontos para a IA de imagem e a lista do que preparar.

**Cidade, vila ou base inteira:** o material certo vem em camadas: o chão limpo visto de cima (sem nada com altura) e uma folha com frente, lateral, fundos e telhado de cada construção importante, mais um atlas de texturas. Se a pessoa só tem uma pintura inclinada, faça o mapa com ela, mas diga na entrega que o resultado melhora muito com essas imagens e mostre os pedidos da seção 2 do `README.md`.

Os comandos abaixo usam `python3`; no Windows, use `py`. As imagens de conferência (grade, prévia, fotos) vão em `rascunho/`, que fica fora do git.

## Primeiro uso

O repositório funciona logo depois do `git clone`, sem instalar nada:

- **Python 3.8 ou mais novo**, só a biblioteca padrão. Opcional: `python3 -m pip install numpy pillow` deixa as ferramentas pesadas de 5 a 10 vezes mais rápidas, com o mesmo resultado. Não instale nada sem a pessoa pedir.
- **Rode os comandos da raiz do repositório.** Cada ferramenta explica o uso com `--help`, termina com código 1 quando dá erro e escreve a saída em UTF-8.
- **Confira o ambiente** antes do primeiro trabalho: `python3 ferramentas/testar.py --rapido` (menos de meio minuto, só Python). Sem o `--rapido`, ele também abre o programa e o editor num navegador sem janela.
- **Chrome, Chromium ou Edge:** só o `foto.py` e a parte de navegador do `testar.py` precisam de um deles. Sem navegador, todo o resto funciona; diga na entrega que não viu o mapa em 3D.
- **Servidor:** as ferramentas não precisam dele (o `foto.py` liga e desliga um sozinho). `python3 servidor.py` fica rodando até Ctrl+C; se for usá-lo, rode em segundo plano.
- **Arquivos da pessoa** (mapas dela, imagens, `src/campanha.js`) ficam fora do git. Num clone novo, só existem os três exemplos.

| A pessoa pede | Ferramentas | Onde está o como |
|---|---|---|
| O mapa de uma planta, navio, cena ao ar livre ou cidade | `grade.py`, `validar.py`, `previa.py`, `foto.py` (e `endireitar.py`, `comparar.py`, `folha.py`) | Passo 0 e passo a passo, abaixo; `GUIA_DE_MAPAS.md` |
| Tirar a grade de batalha da pintura | `quadricula.py`, `apagar.py --ladrilhar` | Regras, abaixo |
| Chão maior, ou partes do lugar mais afastadas | `ampliar.py`, `compor.py` | Regras, abaixo |
| Mata, postes, sebes, muretas | `espalhar.py`, `relevo.py` | `--help` de cada uma |
| Fileiras de móveis iguais (carteiras, bancos, camas) | `repetidos.py` | `--help`; marque um exemplo com `--modelo` e confira com `--conferir` |
| Personagem ou criatura com poses | `figuras.py` | `README.md`, seção 6 |
| Objeto 3D (carro, carroça, barco) | `objeto.py` | `README.md`, seção 6 |
| Vídeo de criatura ou de fundo, sons | ffmpeg (fora do projeto) | `README.md`, seção 7 |
| Conferir criaturas e personagens | `validar_campanha.py` | `README.md`, seção 6 |
| Mudar o programa ou as ferramentas | `testar.py` antes de entregar | `README.md`, seção 8 |

## Passo 0 — a imagem serve?

Antes de qualquer outra coisa:

1. `file assets/interiores/imagem.png` — confirme que é PNG de verdade (converta se for WebP ou JPEG).
2. Abra a imagem e rode a grade na imagem inteira: `python3 ferramentas/grade.py assets/interiores/imagem.png rascunho/g.png --passo 100`.
3. Classifique. Se houver versão de noite, olhe-a também.

| O que você vê | Classificação | O que fazer |
|---|---|---|
| Piso e topo das paredes, como uma planta baixa. Paredes verticais ou horizontais na imagem. | **Reta de cima** | Siga o passo a passo. |
| Piso reto, mas as paredes mostram a face (uma faixa com quadros, lousas, janelas) além do topo. O contorno do prédio ainda é um retângulo. | **Reta com paredes em ângulo** | Siga o passo a passo, usando a regra de "paredes com a face aparente" do guia. Avise a pessoa. |
| Navio, cais, acampamento ou outra cena ao ar livre vista reta de cima; também um prédio com salas fechadas e um pátio ou quadra grande (mais de um terço da planta). | **Reta de cima, a céu aberto** | Siga o passo a passo usando "Céu aberto" e "Pisos elevados e navios" do guia. |
| Prédio com pátio, quadra ou quintal grande, tudo visto reto de cima (escola, quartel, sítio). | **Reta de cima, misto** | Siga o passo a passo. Se a parte a céu aberto é grande (um terço da planta ou mais), use `ceuAberto`, sem `teto`: os cômodos ficam sem teto, como na vista de cima. Se é só uma faixa de jardim em volta do prédio, use `teto` com `area` sobre o prédio ("O lado de fora do prédio", no guia). |
| Vista aérea de um lugar inteiro (cidade, vila, base, porto): ruas retas, prédios desenhados em pé e vistos de fora, vários prédios. | **Lugar inteiro visto do alto** | Siga o passo a passo usando "Lugar inteiro visto do alto" do guia: céu aberto e um volume fechado por prédio. Avise a pessoa de que ninguém entra nos prédios. |
| Ainda é uma planta vista do alto, mas inclinada: o contorno do prédio é um trapézio (paredes laterais inclinadas), a parede do fundo aparece em pé com janelas e portas, os móveis encolhem para o fundo. | **Planta em perspectiva** | Endireite antes (veja abaixo), depois siga o passo a passo como "reta com paredes em ângulo". Avise a pessoa. |
| Não é planta: uma cena vista de dentro ou de fora, com teto ou céu, horizonte, ponto de fuga, pessoas e objetos de frente. | **Ilustração** | **Pare.** |

**Quem decide é o piso.** Meça o mesmo móvel perto do alto e perto do pé da imagem, e veja se as fileiras são paralelas:

- Móveis do mesmo tamanho (diferença de até uns 10%) e fileiras paralelas: o piso é reto. A planta serve, mesmo que as paredes mostrem a face.
- Numa planta com a face aparente é normal que as portas apareçam em pé na face das paredes horizontais, que a escada mostre os degraus e que as paredes laterais inclinem um pouco (até uns 3% da largura da imagem de uma ponta à outra).
- Móveis que encolhem mais de 10% para o fundo, fileiras que convergem ou laterais que inclinam mais de 3%: perspectiva. Endireite.

**Planta em perspectiva: endireitar.** O piso é um plano, então dá para corrigi-lo com exatidão:

1. Se houver versão de noite, compare as duas originais com `comparar.py` antes de mais nada.
2. Renomeie (`mv`) a original para `<id>_perspectiva_dia.png` (e `_noite`). A endireitada passa a ser `<id>_dia.png`, mesmo que a original não tivesse `_dia` no nome.
3. Meça na grade quatro pontos do piso que formam um retângulo de verdade, em geral os cantos do prédio, no pé das paredes (não no topo). Ordem: fundo à esquerda, fundo à direita, frente à direita, frente à esquerda. Quando o pé da parede não aparece:
   - na frente, use a borda de dentro do topo da parede;
   - nas laterais, meça a borda entre a face e o piso em dois pontos visíveis e prolongue a reta;
   - em piso de ladrilho, quatro cruzamentos de ladrilhos que formem um retângulo grande também servem.
4. `python3 ferramentas/endireitar.py <id>_perspectiva_dia.png <id>_dia.png --cantos X1 Y1 X2 Y2 X3 Y3 X4 Y4 --conferir rascunho/conf.png`. Olhe `conf.png` (os cantos sobre a original) e a saída com a grade: as paredes laterais devem ficar na vertical.
5. Confira a profundidade: meça na saída algo redondo ou quadrado no chão (mesa redonda, ladrilho, tapete). Se a largura e a altura forem diferentes, rode de novo com `--esticar`. Até 5% de diferença é aceitável.
6. Versão de noite: se as originais batiam no passo 1, repita com os mesmos `--cantos` e `--esticar`. Se não batiam, meça os cantos da noite à parte e use o `--encaixar` que a execução da de dia imprimiu. Confira o resultado com `comparar.py`.
7. Daí em diante, leia todas as posições na imagem endireitada. Ela é uma planta com paredes de face aparente: descreva cada parede pela `faixa` que ela ocupa.

Na imagem endireitada, o que tem altura aparece esticado para o fundo. Por isso:

- **Escala:** meça só o que está no chão (ladrilho, tapete, largura de uma porta no pé dela).
- **Móveis altos:** a base de verdade é a parte de baixo da pintura. Volumes (armário, máquina) cobrem a pintura inteira; painéis finos (mural, cavalete, biombo) ficam no pé dela.

Avise a pessoa do que não tem conserto: o que está pintado nas paredes (janelas, quadros, letreiros) some sob a parede 3D, e os móveis pequenos que ficam como pintura continuam mostrando a lateral.

Quando parar:

- Não crie `mapas/<id>.json` nem edite `mapas/indice_local.json`.
- Só se para em **ilustração**, ou em planta tão inclinada que as paredes escondem boa parte do piso.
- Diga à pessoa o que viu, com duas ou três evidências medidas na grade. Servem como evidência: uma parede que deveria ser reta e muda de x (ou de y) de uma ponta à outra; o mesmo móvel com tamanhos diferentes perto e longe; linhas paralelas (um corredor, fileiras de bancos) que convergem; a fração da imagem que é piso.
- Explique o que serve no lugar: a mesma planta vista reta de cima, só com o piso e o topo das paredes, e a versão de noite com o mesmo desenho.
- Só faça um rascunho sobre a imagem recusada se a pessoa pedir **depois de avisada** dos defeitos (paredes e janelas pintadas deitadas no chão, móveis desalinhados, escala diferente em cada ponto). O pedido inicial "cria o mapa" não conta.
- **Como fazer esse rascunho** (testado com uma ilustração de igreja): não leia posições na pintura, porque a escala muda de ponto a ponto e o resultado sai torto. Trate a imagem como fundo do piso e monte o lugar com peças 3D e as texturas dos pacotes (`acabamento` nas paredes, em `pisos` e também em `caixa`, `cilindro`, `mesa` e `caixote`), numa escala realista que você escolhe e diz na entrega (uma capela pequena tem uns 10 x 20 m; ajuste `escala` até a planta ter esse tamanho). Use as peças do kit que servem (`banco` com `estilo: "igreja"`, `castical`, `vela`), deixe uma entrada com `porta` ou `portao` (um vão sem peça aparece como buraco preto) e avise que o que era mais bonito na pintura (vitrais, estátuas, teto) não entra.

Atalho: se a maior parte da imagem é parede, janela, teto ou céu (o piso é menos de uns 40% dela), é ilustração; não precisa medir mais nada.

Nenhuma ferramenta faz essa conferência por você.

## Passo a passo

1. **Dia e noite.** A versão de noite precisa ter o mesmo enquadramento da de dia: as paredes e os móveis no mesmo lugar do desenho. O tamanho em pixels pode ser outro, desde que a proporção seja a mesma (o programa estica a de noite sobre o mesmo piso). Detalhes a mais (luzes, vultos, manchas) não atrapalham. Confira com `python3 ferramentas/comparar.py dia.png noite.png rascunho/c.png --clarear 2.5`: ele mede o deslocamento em várias regiões e diz se as duas batem (até 0,4% da largura, uns 6 px numa imagem de 1500); olhe também `c.png` (as linhas devem continuar de uma faixa para a outra). Se ele disser que não batem, deixe `imagemNoite` de fora e diga à pessoa o deslocamento medido.
2. **Leia a planta com a grade.** A imagem inteira primeiro, depois recortes ampliados, vários por vez:
   `python3 ferramentas/grade.py assets/interiores/planta.png rascunho/g.png --passo 100`
   `python3 ferramentas/grade.py assets/interiores/planta.png rascunho/g.png --recorte 0 0 500 400 --recorte 500 0 500 400 --zoom 2 --passo 50`
   Planta escura: acrescente `--clarear 2.5`. Leia as posições na imagem gerada; não estime de cabeça. Para saber a cor de um ponto (`corEntorno`, `agua`, se é calçada ou asfalto), use `--cor X Y` em vez de escrever código: `python3 ferramentas/grade.py planta.png --cor 700 400 --cor 120 900`.
3. **Escala.** Meça móveis e portas (cadeira ≈ 0,45 m, carteira ≈ 0,6 m, porta ≈ 0,9 m, cama de solteiro ≈ 2 m). Se objetos diferentes derem escalas diferentes, móveis e portas valem mais que quadras, ruas e o tamanho do prédio. Se móvel e porta discordarem entre si, fique com um valor entre os dois que deixe os vãos das portas com 0,8 m ou mais. Se uma quadra, rua ou o próprio prédio der uma escala muito diferente (mais de 30%) da dos móveis, a imagem desenhou fora de proporção: fique com a dos móveis e diga na entrega que aquela parte vai parecer pequena (ou grande) em 3D. Diga à pessoa o que usou.
4. **Escreva `mapas/<id>.json`** nesta ordem: plataformas (se houver), paredes externas, paredes internas com os vãos, portas e salas ocultas, móveis grandes, luzes, câmeras, chegada, passagens. O `id` segue `<local>_<parte>` (`escola_terreo`, `predio_andar2`, `igreja_interior`); se a pessoa já nomeou a imagem assim, use o nome dela. Mapa avulso, que não pertence a nenhum local da cidade: omita `local`, o `id` é livre e não precisa de passagem de saída.
5. **Acrescente o arquivo em `mapas/indice_local.json`** (a lista dos mapas da pessoa; crie com `{"mapas": []}` se não existir). `mapas/indice.json` é só a dos exemplos que vêm com o programa: não mexa nela. `python3 ferramentas/validar.py --tudo` confere se as listas ficaram certas.
6. **Valide e olhe o resultado**, repetindo até não haver erro, as peças caírem em cima do desenho e o mapa ficar bom de ver. Leia cada aviso: corrija, ou diga na entrega por que ele ficou.
   `python3 ferramentas/validar.py mapas/<id>.json`
   `python3 ferramentas/previa.py mapas/<id>.json rascunho/p.png --contorno --sem-rotulos` (planta escura: acrescente `--clarear 2.5`, como em `grade.py` e `comparar.py`; `foto.py` não usa `--clarear`, porque mostra o mapa com a luz dele)
   `python3 ferramentas/foto.py mapas/<id>.json rascunho/f.png --camera 0 --camera 1 --de X Y --para X Y` (grava `f_cam0.png`, `f_cam1.png`, `f_vista1.png`: o nome diz a câmera)
   `--contorno` mostra a área que cada parede ocupa de verdade, com a planta visível por baixo. A prévia também aceita vários `--recorte` com `--zoom`, como a grade.
   A **foto** é o mapa em 3D de verdade, tirada sem abrir janela (precisa do Chrome, do Chromium ou do Edge). Tire a vista de planta e duas ou três do chão, olhe, e corrija o que estiver feio: peça virada, altura errada, pintura sobrando, lugar escuro. Se não houver Chrome, diga na entrega que não viu o mapa em 3D.
7. **Entregue dizendo o que é chute.** Liste o que não deu para ler com segurança (em geral: onde ficam as portas, a escala, paredes de vidro) e aponte o editor (`editor.html?mapa=<id>`) para corrigir.

## Regras

- **Só o arquivo do mapa** (e a imagem endireitada, quando for o caso). Criar um mapa não mexe em `src/`. Se a pessoa pedir uma mudança no programa ou nas ferramentas, rode `python3 ferramentas/testar.py` antes de entregar e diga o resultado. Se o formato não cobre algo, aproxime com `caixa` e `cilindro` e avise.
- **Posições em pixels da imagem; tamanhos em metros reais.** O programa amplia os interiores na tela, mas isso não muda o que você escreve.
- **Na dúvida sobre uma porta, deixe o vão aberto.** Interrompa a parede e não crie nem porta nem sala oculta. Um cômodo aberto é melhor que um cômodo preso. Só crie sala oculta quando a planta mostra onde é a porta. Cômodo sem nenhuma entrada desenhada: abra um vão de 1 m na parede que dá para a circulação (corredor ou pátio), perto da ponta mais próxima de onde se chega (a entrada do prédio ou o portão do terreno), e diga na entrega que o lugar é chute.
- **Portão de grade** (de ferro, vazado) não é `porta`: uma porta sem `textura` é uma folha sólida e tapa a vista. Deixe o vão aberto, com a grade pintada no chão, ou ponha a peça `portao` (pilares e telhadinho).
- **Toda área cercada precisa de entrada.** Vale para salas, quintais, quadras cercadas por grade (grade não abre) e o espaço atrás de um balcão.
- **Parede grossa é `faixa`.** Quando a parede cobre uma faixa pintada (topo mais face), escreva `{ "faixa": [x0, y0, x1, y1] }`, o retângulo que ela ocupa, em vez de calcular linha e espessura.
- **Móvel 3D em cima do móvel pintado.** Cubra o que tem mais de uns 0,6 m ou se repete muito (mesas, camas, sofás, balcões, estantes, carteiras); deixe cadeiras e objetos pequenos como pintura.
- **O lado de fora conta.** Se a planta mostra jardim, vegetação, caminho ou cerca em volta do prédio, isso entra no mapa: sem `moldura`, `teto` com `area` só sobre o prédio, luzes e vegetação em 3D do lado de fora, e a chegada no caminho da entrada. Veja "O lado de fora do prédio" no guia.
- **Lugar inteiro com imagens em camadas** (chão limpo e folhas): siga "Cidade em camadas" no começo do guia. Prédio importante é `folhas`; casa pequena é `predios` com texturas do atlas.
- **Lugar inteiro com uma pintura só:** cada telhado pintado vira um item de `predios`, que leva a pintura por cima. Em vista oblíqua, dê a `fachada` de cada um e tire a pintura deles do chão com `apagar.py --predios`. Peças prontas (`casa`, `torreAndares`) só para o que se destaca.
- **Água se mexe.** Se a pintura tem mar, rio ou lago, `"agua": true`. Navio: `balanco: true` no casco.
- **Ao ar livre é `ceuAberto`.** Navio, cidade, base, praia: `"ceuAberto": true`, `corEntorno` com a cor da borda da imagem, sem teto. Veja "Céu aberto" no guia.
- **Navio, cais, palco: `plataformas`.** O que fica acima do chão (o convés sobre a água) é um piso elevado; o que está dentro dele sobe sozinho. Veja "Pisos elevados e navios".
- **Se houver chão limpo, folhas de prédio ou atlas de texturas, use-os.** Veja "O melhor material de entrada" no guia. Se a pessoa só tem uma pintura inclinada e quer mais qualidade, diga a ela que peça essas três imagens à IA que fez a pintura.
- **Poucas luzes.** Uma por cômodo, no meio dele, força entre 0,1 e 0,2. Corredores e salões compridos: uma a cada 8 a 10 m.
- **Móveis repetidos** (fileiras de carteiras, bancos, camas): gere o arquivo com um script curto, fora da pasta do projeto, em vez de digitar um por um.
- **Outros mapas.** Se o mapa novo se liga a um que já existe (uma escada entre andares), crie a passagem no mapa novo e diga à pessoa qual passagem falta no outro. Só edite o outro mapa se ela pedir.
- **Criaturas, personagens e objetos 3D** não são mapas: entram em `src/campanha.js`, com as PNGs recortadas por `figuras.py` e os atlas montados por `objeto.py` (seção 6 do `README.md`). Faça só se a pessoa pedir.
- **Não invente nomes nem história.** Use os nomes que a pessoa der ou descrições neutras ("sala oeste", "sala 1").
- **O nome não define o conteúdo.** Siga as imagens. Se o nome não combina com elas (um "Vale dos Três Rios" com um rio só), não acrescente nada para combinar com o nome; no máximo, comente uma vez na entrega.
- **Quadrícula de mapa de batalha** no chão: tire antes de tudo com `python3 ferramentas/quadricula.py chao.png chao_limpo.png` (`--agua` se sobrar grade clara na água; confira com a grade em recortes ampliados). A rosa dos ventos e os rótulos saem com `apagar.py --ladrilhar`; a moldura, cortando a imagem. Diga à pessoa que pedir a pintura sem grade à IA de imagem dá resultado melhor.
- **Mapa maior que a pintura** (perseguição, mata em volta, estrada que continua): só se anda até 2 m além da borda da imagem. Aumente o chão com `ampliar.py`, não a escala (com a escala, tudo cresce junto). Para espalhar as partes de um lugar, use `compor.py`: cada parte da pintura vai para um lugar de um chão grande, ligadas por trilhas, e a ferramenta imprime a conta que leva as posições lidas na pintura para o chão novo.
- **Folha de prédio em pergaminho** (moldura, manchas, rótulos em volta das vistas): `folha.py folha.png --limpar limpa.png --manter <retângulo de cada vista> --papel`. Os vãos presos no desenho (entre pernas, sob mesas) ficam transparentes. Confira se a quarta vista é mesmo o telhado (a ferramenta avisa) e rode `folha.py --alinhar rascunho/a.png` em toda folha: o telhado fica em cima de cada vista, com linhas-guia. Se a chaminé ou a torre só bate com a lateral desvirada, ela veio espelhada (`--espelhar`); se muda de lugar entre as vistas, avise a pessoa, porque vai aparecer repetida no 3D.

## Conferir no navegador (opcional)

`python3 servidor.py` e abrir `http://127.0.0.1:5173/?mapa=<id>&ang=0` (vista de planta) ou `http://127.0.0.1:5173/editor.html?mapa=<id>`.

## Exemplos

Vêm com o programa (`mapas/indice.json`):

- `mapas/navio_pirata.json`: navio visto de cima, com casco e tombadilho em `plataformas`, mastros, canhões, rochas, palmeiras e cais; céu aberto.
- `mapas/base_artica.json`: base inteira vista do alto, com prédios em `casa`, hangares, muralha em `faixa`, torres, contêineres e veículos.
- `mapas/cidade_feudal.json`: cidade inteira vista do alto, com mais de 200 peças (castelo, pagode, casas, muralhas, pontes, cais, árvores).

Os mapas da pessoa ficam em `mapas/indice_local.json` (fora do git); quando existirem, leia-os também: costumam ser os melhores exemplos do estilo dela.
