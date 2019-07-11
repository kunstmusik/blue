AUTHOR=Steven Yi
TITLE=Hidden Laws
GENRE=Electronic
ALBUM=Hidden Laws
#RELEASE_DATE=$(shell date +"%Y-%m-%d")
RELEASE_DATE=2019-07-11
YEAR=2019

BLUE_CMD=blue64

ARCHIVE_FOLDER=hidden_laws_archive_$(shell date +%Y-%m-%d-%H-%m)

all: hidden_laws.wav hidden_laws.mp3 hidden_laws.ogg hidden_laws.flac hidden_laws.csd

%.csd: %.blue	
	$(BLUE_CMD) --compile $(shell pwd)/$< --output $(shell pwd)/$@ --nosplash --nogui

%.wav: %.csd
	csound -Wdo $@ $<

%.mp3: %.wav
	lame -b 320 -h --ta "$(AUTHOR)" --tt "$(TITLE)" --tg "$(GENRE)" --tl "$(ALBUM)" --ty "$(YEAR)" --tc "$(RELEASE_DATE)" --ti images/album_cover.png $< 

%.flac: %.wav
	flac --tag="TITLE=$(TITLE)" --tag="ALBUM=$(ALBUM)" --tag="ARTIST=$(AUTHOR)" --tag="DATE=$(RELEASE_DATE)" --tag="GENRE=$(GENRE)" -f -o $@ $< 
	metaflac --import-picture-from=images/album_cover.png $@

# TODO - Does not embed album art
%.ogg: %.wav
	oggenc -q9 -t "$(TITLE)" -l "$(ALBUM)" -a "$(AUTHOR)" -d "$(RELEASE_DATE)" -G "$(GENRE)" $< 

archive:
	mkdir $(ARCHIVE_FOLDER)
	cp *.wav $(ARCHIVE_FOLDER)/
	cp *.mp3 $(ARCHIVE_FOLDER)/
	cp *.ogg $(ARCHIVE_FOLDER)/
	cp *.flac $(ARCHIVE_FOLDER)/

zip:
	git archive --format zip --prefix syi_hidden_laws/ HEAD > syi_hidden_laws.zip

clean:
	rm *.wav
	rm *.mp3
	rm *.ogg
	rm *.flac
	rm *.zip
