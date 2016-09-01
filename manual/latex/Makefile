PAPER=index.pdf

ifeq ($(shell uname -s),Linux) 
	OPEN_CMD=xdg-open
else
	OPEN_CMD=open
endif

ifeq ($(shell uname -s),MINGW64_NT-10.0) 
  OPEN_CMD=start
endif

all: $(PAPER)

clean:
	rm -rf output

#clean: cleantmp
#  rm -f *.pdf

#cleantmp:
#  rm -f *.aux
#  rm -f *.bbl
#  rm -f *.blg
#  rm -f *.log

#index.pdf: index.tex syi_dissertation.bbl
index.pdf: index.tex 
	mkdir -p output
	find . -type d -not -path ./output -not -path "./output/*" -exec mkdir -p output/{} \;
	pdflatex --output-directory=output -shell-escape index 
	pdflatex --output-directory=output -shell-escape index 
	$(OPEN_CMD) output/index.pdf

#syi_dissertation.bbl:	syi_dissertation.bib
#  mkdir -p output
#  pdflatex --output-directory=output -shell-escape syi_dissertation 
#  cd output; cp ../syi_dissertation.bib .; bibtex syi_dissertation

#wc:
#  texcount -inc syi_dissertation.tex -brief

.PHONY:all clean 
